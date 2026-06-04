const { pool } = require("../../config/db");
const axios = require("axios");
const moment = require("moment");
const { normalizeDisciplineFrom1c } = require("./normalizeDisciplineFrom1c");
const { mapApiDataFor1c, hashPayload, loadReferenceTree } = require("./specProfilesMapping");
const { merge1cIntoReferenceTree } = require("./specProfilesTransformer");

const apiUrl = "https://1c-api.uni-dubna.ru/v1/api/persons/reports";
const CACHE_ROW_ID = 1;
const SPEC_PROFILES_TIMEOUT_MS = 5000;

const isRetryable1cError = (error) => {
  if (!error || error.statusCode) {
    return false;
  }

  const status = error.response?.status;
  if (typeof status === "number") {
    return status >= 500 || status === 429;
  }

  return true;
};

const requestWithSingleRetry = async (requestFn, requestName) => {
  try {
    return await requestFn();
  } catch (error) {
    if (!isRetryable1cError(error)) {
      throw error;
    }

    console.warn(`${requestName} failed, retrying once...`, error.message);
    return await requestFn();
  }
};

async function exchange1C(apiData, { userId } = {}) {
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

const fetchUpLink = async (apiData) => {
  try {
    const url = `${apiUrl}/GetDisciplinesByPlan`;

    const response = await requestWithSingleRetry(
      () =>
        axios.post(url, mapApiDataFor1c(apiData), {
          timeout: 30000,
        }),
      "GetDisciplinesByPlan"
    );

    if (!response.data?.length) {
      const error = new Error("По данному комплекту нет данных от 1С");
      error.statusCode = 422;
      throw error;
    }

    return response.data;
  } catch (error) {
    throw handle1cError(error);
  }
};

const createRpdComplect = async (apiData) => {
  const { rows } = await pool.query(
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

const processDisciplines = async (disciplines, RpdComplectId) => {
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

const insertDiscipline = async (data) => {
  const discipline = (data.discipline || "").trim();
  if (!discipline) return null;

  const recordType = data.record_type ?? "";
  const semester = data.semester ?? null;

  const { rows: existing } = await pool.query(
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

  const { rows } = await pool.query(
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

const insertStatusHistory = async (templateId) => {
  const { rows: existing } = await pool.query(
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

const insertUserComplectId = async (userId, complectId) => {
  await pool.query(
    `
    INSERT INTO user_complect (user_id, complect_id)
    VALUES ($1, $2)
    `,
    [userId, complectId]
  );
};

const handle1cError = (error) => {
  if (error.statusCode) {
    return error;
  }
  if (error.code === "ECONNABORTED" || error.response?.status === 504) {
    const serviceError = new Error("Сервис 1С временно недоступен");
    serviceError.statusCode = 503;
    return serviceError;
  }
  return error;
};

const fetchAllSpecProfiles = async () => {
  try {
    const url = `${apiUrl}/GetAllSpecProfiles`;
    const response = await axios.get(url, {
      timeout: SPEC_PROFILES_TIMEOUT_MS,
    });

    if (!Array.isArray(response.data)) {
      const error = new Error("Некорректный ответ 1С по профилям");
      error.statusCode = 502;
      throw error;
    }

    return response.data;
  } catch (error) {
    throw handle1cError(error);
  }
};

const readCachedSpecProfiles = async (dbPool) => {
  const { rows } = await dbPool.query(
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

const upsertSpecProfilesCache = async (dbPool, rawPayload, treePayload, payloadHash) => {
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

const syncAndGetSpecProfiles = async (dbPool) => {
  try {
    const rawPayload = await fetchAllSpecProfiles();
    const tree = merge1cIntoReferenceTree(rawPayload);
    const payloadHash = hashPayload(tree);

    const { rows } = await dbPool.query(
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
    if (error?.response?.status === 504 || error?.code === "ECONNABORTED") {
      console.warn("GetAllSpecProfiles timeout/504, using cache or fallback");
    } else {
      console.warn("GetAllSpecProfiles failed, using cache or fallback:", error.message);
    }

    const cachedTree = await readCachedSpecProfiles(dbPool);
    if (cachedTree) {
      return { tree: cachedTree, source: "database" };
    }

    return { tree: loadReferenceTree(), source: "fallback" };
  }
};

module.exports = {
  exchange1C,
  fetchUpLink,
  fetchAllSpecProfiles,
  syncAndGetSpecProfiles,
};
