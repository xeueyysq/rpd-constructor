const Rpd1cExchange = require("../models/rpd_1c_exchange");
const RpdComplects = require("../models/rpd_complects");
const { findRpd } = require("../services/Complects");

class Rpd1cExchangeController {
  constructor(pool) {
    this.pool = pool;
    this.model = new Rpd1cExchange(pool);
    this.complectsModel = new RpdComplects(pool);
  }

  async setResultsData(req, res) {
    try {
      const { data, complectId } = req.body;

      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }

      const complectMeta = await this.complectsModel.findRpdComplectMeta(
        complectId
      );
      if (!complectMeta?.id) {
        return res
          .status(404)
          .json({ message: "Комплект не найден" });
      }

      const records = await this.model.setResultsData(
        Array.isArray(data) ? data : [],
        complectMeta.id
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async getResultsData(req, res) {
    try {
      const complectIdRaw = req.query?.complectId;
      if (!complectIdRaw) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }

      const complectMeta = await this.complectsModel.findRpdComplectMeta(
        complectIdRaw
      );
      if (!complectMeta?.id) {
        return res
          .status(404)
          .json({ message: "Комплект не найден" });
      }

      const records = await this.model.getResultsData(complectMeta.id);
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

      if (!complectId) {
        return res
          .status(400)
          .json({ result: "validation_error", message: "Не указан complectId" });
      }

      const complectMeta = await this.complectsModel.findRpdComplectMeta(
        complectId
      );
      if (!complectMeta?.id) {
        return res
          .status(404)
          .json({ message: "Комплект не найден" });
      }

      const record = await this.model.createTemplate(
        id_1c,
        complectMeta.id,
        Array.isArray(teachers) ? teachers : teacher,
        year,
        discipline,
        userName
      );
      res.json(record);
    } catch (err) {
      const validationErrors = [
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
