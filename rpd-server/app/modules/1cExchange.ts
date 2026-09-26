import type { Pool } from "pg";
import { pool } from "../../config/db.ts";
import axios from "axios";
import moment from "moment";
import { normalizeDisciplineFrom1c } from "./normalizeDisciplineFrom1c.ts";
import { mapApiDataFor1c, hashPayload, loadReferenceTree } from "./specProfilesMapping.ts";
import { merge1cIntoReferenceTree } from "./specProfilesTransformer.ts";

const apiUrl = "https://1c-api.uni-dubna.ru/v1/api/persons/reports";
const CACHE_ROW_ID = 1;
const SPEC_PROFILES_TIMEOUT_MS = 5000;

type ApiData = { faculty: string | null; year: number | null; educationForm: string | null; educationLevel: string | null; profile: string | null; direction: string | null };
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

async function exchange1C(apiData: ApiData, { userId }: { userId?: number } = {}) {
  try {
    const disciplines = await fetchUpLink(apiData);
    const RpdComplectId = await createRpdComplect(apiData);
    if (userId) {
      await insertUserComplectId(userId, RpdComplectId);
    }
    await processDisciplines(disciplines, RpdComplectId);
    return RpdComplectId;
  } catch (error) {
    console.error("Ошибка загрузки комплекта:", error);
    throw error;
  }
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

const createRpdComplect = async (apiData: ApiData) => {
  const { rows } = await pool.query<{ id: number }>(
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
    DO UPDATE SET
      faculty = EXCLUDED.faculty
    RETURNING id
    `,
    [
      apiData.faculty,
      apiData.year,
      apiData.educationForm,
      apiData.educationLevel,
      apiData.profile,
      apiData.direction,
    ]
  );

  const RpdComplectId = rows[0]?.id;
  if (!RpdComplectId) {
    throw new Error("Ошибка создания комплекта РПД");
  }

  return RpdComplectId;
};

const processDisciplines = async (disciplines: unknown[], RpdComplectId: number) => {
  const recordsLength = disciplines.length;
  console.log(`Всего дисциплин из запроса - ${recordsLength}`);

  const promises = disciplines.map(async (disc, index) => {
    console.log(`Дисциплина ${index + 1} из ${recordsLength} обрабатывается`);
    const normalized = normalizeDisciplineFrom1c(disc);

    if (!normalized.discipline) {
      console.warn(
        `Дисциплина ${index + 1} из ${recordsLength} пропущена: пустое название`
      );
      return;
    }

    const insertedId = await insertDiscipline({
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
      await insertStatusHistory(insertedId);
    }
  });

  await Promise.all(promises);
};

const insertDiscipline = async (data: { RpdComplectId: number; division: string; discipline: string; teachers: string[]; zets: number | null; place: string; record_type: string; study_load: unknown; control_load: unknown; semester: number | null }) => {
  const discipline = (data.discipline || "").trim();
  if (!discipline) return null;

  const recordType = data.record_type ?? "";
  const semester = data.semester ?? null;

  const { rows: existing } = await pool.query<{ id: number }>(
    `
      SELECT id
      FROM rpd_1c_exchange
      WHERE id_rpd_complect = $1
        AND discipline = $2
        AND semester IS NOT DISTINCT FROM $3
        AND COALESCE(record_type, '') = COALESCE($4, '')
      LIMIT 1
    `,
    [data.RpdComplectId, discipline, semester, recordType]
  );

  if (existing[0]?.id) return null;

  const { rows } = await pool.query<{ id: number }>(
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

  return rows[0]?.id ?? null;
};

const insertStatusHistory = async (templateId: number) => {
  const { rows: existing } = await pool.query<{ id: number }>(
    `
      SELECT id
      FROM template_status
      WHERE id_1c_template = $1
      LIMIT 1
    `,
    [templateId]
  );

  if (existing.length) return;

  const history = [
    {
      date: moment().format(),
      status: "unloaded",
      user: "Система",
    },
  ];

  await pool.query(
    `
    INSERT INTO template_status (id_1c_template, history) 
    VALUES ($1, $2)
    `,
    [templateId, JSON.stringify(history)]
  );
};

const insertUserComplectId = async (userId: number, complectId: number) => {
  await pool.query(
    `
    INSERT INTO user_complect (user_id, complect_id)
    VALUES ($1, $2)
    `,
    [userId, complectId]
  );
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

const fetchAllSpecProfiles = async () => {
  try {
    const url = `${apiUrl}/GetAllSpecProfiles`;
    const response = await axios.get<unknown>(url, {
      timeout: SPEC_PROFILES_TIMEOUT_MS,
    });

    if (!Array.isArray(response.data)) {
      const error = new Error("Некорректный ответ 1С по профилям") as ServiceError;
      error.statusCode = 502;
      throw error;
    }

    return response.data;
  } catch (error) {
    throw handle1cError(error);
  }
};

const readCachedSpecProfiles = async (dbPool: Pool) => {
  const { rows } = await dbPool.query<{ tree_payload: unknown }>(
    `
      SELECT tree_payload
      FROM spec_profiles_cache
      WHERE id = $1
      LIMIT 1
    `,
    [CACHE_ROW_ID]
  );

  return rows[0]?.tree_payload ?? null;
};

const upsertSpecProfilesCache = async (dbPool: Pool, rawPayload: unknown, treePayload: unknown, payloadHash: string) => {
  await dbPool.query(
    `
      INSERT INTO spec_profiles_cache (
        id,
        raw_payload,
        tree_payload,
        payload_hash,
        synced_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        raw_payload = EXCLUDED.raw_payload,
        tree_payload = EXCLUDED.tree_payload,
        payload_hash = EXCLUDED.payload_hash,
        synced_at = NOW()
    `,
    [CACHE_ROW_ID, JSON.stringify(rawPayload), JSON.stringify(treePayload), payloadHash]
  );
};

const syncAndGetSpecProfiles = async (dbPool: Pool) => {
  try {
    const rawPayload = await fetchAllSpecProfiles();
    const tree = merge1cIntoReferenceTree(rawPayload);
    const payloadHash = hashPayload(tree);

    const { rows } = await dbPool.query<{ payload_hash: string }>(
      `
        SELECT payload_hash
        FROM spec_profiles_cache
        WHERE id = $1
        LIMIT 1
      `,
      [CACHE_ROW_ID]
    );

    if (rows[0]?.payload_hash !== payloadHash) {
      await upsertSpecProfilesCache(dbPool, rawPayload, tree, payloadHash);
    }

    return { tree, source: "1c" };
  } catch (error) {
    if (errorDetails(error).response?.status === 504 || errorDetails(error).code === "ECONNABORTED") {
      console.warn("GetAllSpecProfiles timeout/504, using cache or fallback");
    } else {
      console.warn("GetAllSpecProfiles failed, using cache or fallback:", error instanceof Error ? error.message : String(error));
    }

    const cachedTree = await readCachedSpecProfiles(dbPool);
    if (cachedTree) {
      return { tree: cachedTree, source: "database" };
    }

    return { tree: loadReferenceTree(), source: "fallback" };
  }
};

export {
  exchange1C,
  fetchUpLink,
  fetchAllSpecProfiles,
  syncAndGetSpecProfiles,
};
