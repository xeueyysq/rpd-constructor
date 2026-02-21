const { pool } = require("../../config/db");
const axios = require("axios");
const moment = require("moment");

const apiUrl = "https://1c-api.uni-dubna.ru/v1/api/persons/reports";

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
    const normalizedYear = Number(apiData.year);

    const response = await requestWithSingleRetry(
      () =>
        axios.post(
          url,
          {
            year: Number.isFinite(normalizedYear) ? normalizedYear : apiData.year,
            education_level: apiData.educationLevel,
            education_form: apiData.educationForm,
            direction: apiData.direction,
          },
          {
            timeout: 30000,
          }
        ),
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
    ) RETURNING id
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
    const {
      discipline = "",
      semester = null,
      division = "",
      teachers = [],
      zets = null,
      place = "",
      study_load = {},
      control_load = {},
    } = disc || {};

    const normalizedSemester = Number(semester);
    const normalizedZets = Number(zets);
    const normalizedTeachers = Array.isArray(teachers)
      ? teachers.filter(
          (teacher) => typeof teacher === "string" && teacher.trim()
        )
      : typeof teachers === "string" && teachers.trim()
        ? [teachers.trim()]
        : [];
    const normalizedStudyLoad =
      study_load && typeof study_load === "object" && !Array.isArray(study_load)
        ? study_load
        : {};
    const normalizedControlLoad =
      control_load &&
      typeof control_load === "object" &&
      !Array.isArray(control_load)
        ? control_load
        : {};

    const insertedId = await insertDiscipline({
      RpdComplectId,
      division,
      discipline,
      teachers: normalizedTeachers,
      zets: Number.isFinite(normalizedZets) ? normalizedZets : null,
      place,
      study_load: normalizedStudyLoad,
      control_load: normalizedControlLoad,
      semester: Number.isFinite(normalizedSemester) ? normalizedSemester : null,
    });

    if (insertedId) {
      await insertStatusHistory(insertedId);
    }
  });

  await Promise.all(promises);
};

const insertDiscipline = async (data) => {
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
      semester
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    ) 
    ON CONFLICT DO NOTHING
    RETURNING id
    `,
    [
      data.RpdComplectId,
      data.division,
      data.discipline,
      data.teachers,
      data.zets,
      data.place,
      JSON.stringify(data.study_load),
      JSON.stringify(data.control_load ?? {}),
      data.semester,
    ]
  );

  return rows[0]?.id ?? null;
};

const insertStatusHistory = async (templateId) => {
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

module.exports = { exchange1C, fetchUpLink };
