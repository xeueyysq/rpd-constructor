import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/db.ts";
import axios from "axios";
import { initializeRpdFromExchange } from "./initializeRpdFromExchange.ts";
import { normalizeDisciplineFrom1c } from "./normalizeDisciplineFrom1c.ts";
import { mapApiDataFor1c } from "./specProfilesMapping.ts";
import type { UserClaims } from "../types/express.d.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import { importTeacherCards } from "./teacherImport.ts";
import { USER_ROLES } from "../models/constants.ts";
import { Forbidden, Unprocessable } from "../utils/Errors.ts";

const apiUrl = "https://1c-api.uni-dubna.ru/v1/api/persons/reports";

type ApiData = { faculty: string | null; year: number | string | null; educationForm: string | null; educationLevel: string | null; profile: string | null; direction: string | null };
type ServiceError = Error & { statusCode?: number };
function errorDetails(error: unknown): { statusCode?: unknown; code?: unknown; response?: { status?: number } } {
  return error && typeof error === "object" ? error as { statusCode?: unknown; code?: unknown; response?: { status?: number } } : {};
}

const isRetryable1cError = (error: unknown) => {
  const details = errorDetails(error);
  if (!error || details.statusCode) {
    return false;
  }

  const status = details.response?.status;
  if (typeof status === "number") {
    return status >= 500 || status === 429;
  }

  return true;
};

const requestWithSingleRetry = async <T>(requestFn: () => Promise<T>, requestName: string) => {
  try {
    return await requestFn();
  } catch (error) {
    if (!isRetryable1cError(error)) {
      throw error;
    }

    console.warn(`${requestName} failed, retrying once...`, error instanceof Error ? error.message : String(error));
    return await requestFn();
  }
};

async function assertActiveCreator(db: Pick<Pool | PoolClient, "query">, actor: UserClaims) {
  if (actor.role !== USER_ROLES.ROP && actor.role !== USER_ROLES.ADMIN) {
    throw new Forbidden("Создание комплекта доступно только РОП и администратору");
  }
  const { rows } = await db.query<{ role: number; is_active: boolean }>(
    "SELECT id,role,is_active FROM users WHERE id=$1 FOR SHARE", [actor.id],
  );
  if (!rows[0]?.is_active || rows[0].role !== actor.role) {
    throw new Forbidden("Создание комплекта доступно только активному пользователю с текущей ролью");
  }
}

function validateComplectCriteria(apiData: ApiData) {
  const strings = [apiData.faculty, apiData.educationForm, apiData.educationLevel, apiData.profile, apiData.direction];
  const year = typeof apiData.year === "number" ? apiData.year
    : typeof apiData.year === "string" && /^\d+$/.test(apiData.year) ? Number(apiData.year) : NaN;
  if (strings.some((value) => typeof value !== "string" || !value.trim())
    || !Number.isInteger(year) || year <= 0 || year > 2147483647) {
    throw new Unprocessable("Укажите полные данные комплекта и корректный год набора");
  }
}

async function exchange1C(apiData: ApiData, { actor, database = pool }: { actor?: UserClaims; database?: Pool } = {}) {
  if (actor) await assertActiveCreator(database, actor);
  validateComplectCriteria(apiData);
  const disciplines = await fetchUpLink(apiData);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const { id: RpdComplectId, created } = await createRpdComplect(client, apiData);
    if (actor) {
      // Как в sync/назначении РОП: сначала комплект, затем пользователь до COMMIT.
      await assertActiveCreator(client, actor);
      if (created) {
        await client.query("INSERT INTO user_complect(user_id,complect_id) VALUES($1,$2) ON CONFLICT(user_id,complect_id) DO NOTHING", [actor.id, RpdComplectId]);
      } else {
        await TemplateAccess.assertComplect(client, actor, RpdComplectId);
      }
    }
    await importTeacherCards(client, disciplines.flatMap((disc) => normalizeDisciplineFrom1c(disc).teachers));
    await processDisciplines(client, disciplines, RpdComplectId);
    await client.query("COMMIT");
    return RpdComplectId;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка загрузки комплекта:", error);
    throw error;
  } finally { client.release(); }
}

const fetchUpLink = async (apiData: ApiData) => {
  try {
    const url = `${apiUrl}/GetDisciplinesByPlan`;

    const response = await requestWithSingleRetry(
      () =>
        axios.post<unknown>(url, mapApiDataFor1c(apiData), {
          timeout: 30000,
        }),
      "GetDisciplinesByPlan"
    );

    if (!(response.data as { length?: number } | null)?.length) {
      const error = new Error("По данному комплекту нет данных от 1С") as ServiceError;
      error.statusCode = 422;
      throw error;
    }

    return response.data as unknown[];
  } catch (error) {
    throw handle1cError(error);
  }
};

const createRpdComplect = async (client: PoolClient, apiData: ApiData) => {
  const values = [apiData.faculty, apiData.year, apiData.educationForm, apiData.educationLevel, apiData.profile, apiData.direction];
  for (;;) {
    const { rows } = await client.query<{ id: number }>(
      `
      INSERT INTO rpd_complects (
        faculty,
        year,
        education_form,
        education_level,
        profile,
        direction
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
      ON CONFLICT (
        faculty,
        year,
        education_form,
        education_level,
        profile,
        direction
      )
      DO NOTHING
      RETURNING id
      `,
      values
    );
    if (rows[0]) return { id: rows[0].id, created: true };
    // Отдельная команда видит конкурентную вставку после ON CONFLICT.
    // Блокировка сериализует импорт с sync и изменением владельцев.
    const { rows: existing } = await client.query<{ id: number }>(`
      SELECT id FROM rpd_complects
      WHERE faculty=$1 AND year=$2 AND education_form=$3 AND education_level=$4
        AND profile=$5 AND direction=$6
      FOR UPDATE
    `, values);
    if (existing[0]) return { id: existing[0].id, created: false };
    // Между конфликтом и SELECT строку могли удалить: повторяем вставку.
  }
};

const processDisciplines = async (client: PoolClient, disciplines: unknown[], RpdComplectId: number) => {
  const recordsLength = disciplines.length;
  console.log(`Всего дисциплин из запроса - ${recordsLength}`);

  for (const [index, disc] of disciplines.entries()) {
    console.log(`Дисциплина ${index + 1} из ${recordsLength} обрабатывается`);
    const normalized = normalizeDisciplineFrom1c(disc);

    if (!normalized.discipline) {
      console.warn(
        `Дисциплина ${index + 1} из ${recordsLength} пропущена: пустое название`
      );
      continue;
    }

    const insertedId = await insertDiscipline(client, {
      RpdComplectId,
      division: normalized.department,
      discipline: normalized.discipline,
      teachers: normalized.teachers,
      zets: normalized.zet,
      place: normalized.place,
      record_type: normalized.record_type,
      study_load: normalized.study_load,
      control_load: normalized.control_load,
      semester: normalized.semester,
    });

    if (insertedId) {
      await initializeRpdFromExchange(client, insertedId, RpdComplectId);
    }
  }
};

const insertDiscipline = async (client: PoolClient, data: { RpdComplectId: number; division: string; discipline: string; teachers: string[]; zets: number | null; place: string; record_type: string; study_load: unknown; control_load: unknown; semester: number | null }) => {
  const discipline = (data.discipline || "").trim();
  if (!discipline) return null;

  const recordType = data.record_type ?? "";
  const semester = data.semester ?? null;

  const { rows } = await client.query<{ id: number }>(
    `
    INSERT INTO rpd_1c_exchange (
      id_rpd_complect,
      department,
      discipline,
      teachers, 
      zet,
      place,
      study_load,
      control_load,
      semester,
      record_type
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    )
    ON CONFLICT (id_rpd_complect, discipline, COALESCE(semester, -1), COALESCE(record_type, '')) DO NOTHING
    RETURNING id
    `,
    [
      data.RpdComplectId,
      data.division,
      discipline,
      data.teachers,
      data.zets,
      data.place,
      JSON.stringify(data.study_load),
      JSON.stringify(data.control_load ?? {}),
      semester,
      recordType,
    ]
  );

  if (rows[0]) return rows[0].id;
  const { rows: existing } = await client.query<{ id: number }>(`
    SELECT id FROM rpd_1c_exchange
    WHERE id_rpd_complect = $1 AND discipline = $2
      AND COALESCE(semester, -1) = COALESCE($3::int, -1)
      AND COALESCE(record_type, '') = COALESCE($4, '')
    FOR UPDATE
  `, [data.RpdComplectId, discipline, semester, recordType]);
  if (!existing[0]) throw new Error("Строка 1С не найдена после загрузки");
  return existing[0].id;
};

const handle1cError = (error: unknown) => {
  const details = errorDetails(error);
  if (details.statusCode) {
    return error;
  }
  if (details.code === "ECONNABORTED" || details.response?.status === 504) {
    const serviceError = new Error("Сервис 1С временно недоступен") as ServiceError;
    serviceError.statusCode = 503;
    return serviceError;
  }
  return error;
};

export {
  exchange1C,
  fetchUpLink,
};
