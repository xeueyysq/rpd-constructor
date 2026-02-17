const Rpd1cExchange = require("../models/rpd_1c_exchange");
const { findRpd } = require("../services/Complects");

class Rpd1cExchangeController {
  constructor(pool) {
    this.model = new Rpd1cExchange(pool);
  }

  async setResultsData(req, res) {
    try {
      const { data, complectId } = req.body;

      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }

      const records = await this.model.setResultsData(
        Array.isArray(data) ? data : [],
        Number(complectId)
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async getResultsData(req, res) {
    try {
      const complectId = Number(req.query?.complectId);

      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }

      const records = await this.model.getResultsData(complectId);
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async findRpd(req, res) {
    try {
      const { complectId } = req.body;
      const records = await findRpd(this.model.pool, complectId);
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async createTemplate(req, res) {
    try {
      const { id_1c, complectId, teachers, teacher, year, discipline, userName } = req.body;
      const record = await this.model.createTemplate(
        id_1c,
        complectId,
        Array.isArray(teachers) ? teachers : teacher,
        year,
        discipline,
        userName
      );
      res.json(record);
    } catch (err) {
      const validationErrors = [
        "Не выбраны преподаватели",
        "Не указан id_1c",
        "Не указан complectId",
        "Не указана дисциплина",
        "Шаблон 1С не найден",
      ];
      const isValidation = validationErrors.some((msg) => err.message === msg);
      if (isValidation) {
        return res.status(400).json({ result: "validation_error", message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  }
}

module.exports = Rpd1cExchangeController;
