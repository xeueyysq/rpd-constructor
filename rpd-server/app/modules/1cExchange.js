const { pool } = require("../../config/db");
const axios = require("axios");
const moment = require("moment");

const apiUrl = "https://1c-api.uni-dubna.ru/v1/api/persons/reports";

async function exchange1C(apiData, { userId } = {}) {
  try {
    const disc = await fetchUpLink(apiData);
    const upLinks = disc[0].upLink;
    const discs = await Promise.all(
      upLinks.map(async (upLink) => {
        return await fetchDiscs(upLink);
      })
    );
    const RpdComplectId = await createRpdComplect(apiData);
    if (userId) {
      await insertUserComplectId(userId, RpdComplectId);
    }
    await processDisciplines(discs, RpdComplectId);
    return RpdComplectId;
  } catch (error) {
    console.error("Ошибка загрузки комплекта:", error);
    throw error;
  }
}

const fetchUpLink = async (apiData) => {
  try {
    const url = `${apiUrl}/SearchUP`;

    const response = await axios.get(url, {
      timeout: 30000,
      params: {
        Year: apiData.year,
        Education_Level: apiData.educationLevel,
        Education_Form: apiData.educationForm,
        Profile: apiData.profile,
        Direction: apiData.direction,
      },
    });

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

const fetchDiscs = async (upLink) => {
  try {
    const url = `${apiUrl}/SearchInfoWithDiscs`;
    const response = await axios.get(url, {
      timeout: 30000,
      params: {
        UPLink: upLink,
      },
    });
    if (!response.data) {
      const error = new Error("Нет данных от 1С");
      error.statusCode = 503;
      throw error;
    }
    return response.data;
  } catch (error) {
    throw handle1cError(error);
  }
};

const fetchDiscInfo = async (upLink, discLink) => {
  try {
    const url = `${apiUrl}/SearchDiscsDetails`;
    const response = await axios.get(url, {
      timeout: 30000,
      params: {
        UPLink: upLink,
        DiscLink: discLink,
      },
    });
    if (!response.data) {
      const error = new Error("Нет данных от 1С");
      error.statusCode = 503;
      throw error;
    }
    return response.data;
  } catch (error) {
    throw handle1cError(error);
  }
};

const processDisciplines = async (disciplines, RpdComplectId) => {
  const recordsLength = disciplines.length;
  console.log(`Всего дисциплин из запроса - ${recordsLength}`);

  const promises = disciplines.map(async (record, index) => {
    record[0].discInfo.map(async (disc) => {
      console.log(`Дисциплина ${index + 1} из ${recordsLength} обрабатывается`);
      const discInfo = await fetchDiscInfo(record[0].upLink, disc.discLink);

      if (!discInfo || !discInfo[0]) {
        console.error(
          `Нет данных для ${disc.discipline} с discLink: ${disc.discLink} и upLink ${record[0].upLink}`
        );
      }

      const { place = "", study_load = {} } = discInfo?.[0] || {};
      const {
        discipline = "",
        semester = null,
        division = "",
        teachers = "",
        zets = null,
      } = disc;
      const insertedId = await insertDiscipline({
        RpdComplectId,
        division,
        discipline,
        teachers,
        zets,
        place,
        study_load,
        semester,
      });

      await insertStatusHistory(insertedId);
    });
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
      semester
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
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
      data.semester,
    ]
  );

  return rows[0].id;
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

module.exports = { exchange1C, fetchUpLink, fetchDiscInfo: fetchDiscs };
