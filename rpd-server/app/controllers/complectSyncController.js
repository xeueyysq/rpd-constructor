const {
  preview1cSync,
  applySync,
  acknowledgeFieldChanges,
} = require("../modules/complectSync");

class ComplectSyncController {
  constructor(pool) {
    this.pool = pool;
  }

  async preview(req, res) {
    try {
      const { complectId } = req.body;
      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }
      const result = await preview1cSync(complectId);
      res.json(result);
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message });
    }
  }

  async apply(req, res) {
    try {
      const { complectId, selections } = req.body;
      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }
      const result = await applySync({
        complectId,
        selections,
        userId: req.user?.id,
      });
      res.json(result);
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message });
    }
  }

  async acknowledgeFieldChanges(req, res) {
    try {
      const { profileTemplateId, changeIds } = req.body;
      if (!profileTemplateId) {
        return res.status(400).json({ message: "Не указан шаблон" });
      }
      const result = await acknowledgeFieldChanges(
        profileTemplateId,
        changeIds
      );
      res.json(result);
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message });
    }
  }
}

module.exports = ComplectSyncController;
