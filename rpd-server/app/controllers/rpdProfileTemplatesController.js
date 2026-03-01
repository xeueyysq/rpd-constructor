const RpdProfileTemplates = require("../models/rpd_profile_templates");

class RpdProfileTemplatesController {
  constructor(pool) {
    this.model = new RpdProfileTemplates(pool);
  }

  async getJsonProfile(req, res) {
    try {
      const { id } = req.body;
      const value = await this.model.getJsonProfile(id);
      res.json(value);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async updateById(req, res) {
    try {
      const updatedItem = await this.model.updateById(
        req.params.id,
        req.body.fieldToUpdate,
        req.body.value
      );
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updatedItem);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async upsetTemplateComment(req, res) {
    try {
      const commentatorId = req.user?.id;
      if (!commentatorId) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      const { field, value } = req.body;
      if (!field) {
        return res.status(400).json({ message: "Не указано поле" });
      }

      const updatedItem = await this.model.upsetTemplateComment(
        req.params.id,
        commentatorId,
        field,
        value
      );

      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: error.message });
      console.error(error);
    }
  }

  async deleteTemplateComment(req, res) {
    try {
      const deleteResult = await this.model.deleteTemplateComment(
        req.params.id
      );

      if (!deleteResult) {
        return res.status(404).json({
          message: "Комментарий не найден",
        });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
      console.error(error);
    }
  }

  async findByCriteria(req, res) {
    try {
      const {
        faculty,
        levelEducation,
        directionOfStudy,
        profile,
        formEducation,
        year,
      } = req.query;
      const records = await this.model.findByCriteria(
        faculty,
        levelEducation,
        directionOfStudy,
        profile,
        formEducation,
        year
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async findOrCreate(req, res) {
    try {
      const { disciplinsName, id, year, userName } = req.body;
      const record = await this.model.findOrCreateByDisciplineAndYear(
        disciplinsName,
        id,
        year,
        userName
      );
      res.json(record);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  async copyTemplateData(req, res) {
    try {
      const { sourceTemplateId, targetTemplateId, fieldToCopy } = req.body;

      if (!sourceTemplateId || !targetTemplateId || !fieldToCopy) {
        return res.status(400).json({
          message: "Нет необходимых параметров",
        });
      }

      const result = await this.model.copyTemplateData(
        sourceTemplateId,
        targetTemplateId,
        fieldToCopy
      );

      res.json(result);
    } catch (err) {
      console.error("Ошибка контроллера:", err);
      res.status(500).json({ message: err.message });
    }
  }

  async copyTemplateContent(req, res) {
    try {
      const { sourceTemplateId, targetTemplateId } = req.body;

      if (!sourceTemplateId || !targetTemplateId) {
        return res.status(400).json({
          message: "Нет необходимых параметров",
        });
      }

      const sourceId = await this.model.resolveTemplateId(sourceTemplateId);
      const targetId = await this.model.resolveTemplateId(targetTemplateId);
      if (sourceId != null && targetId != null && sourceId === targetId) {
        return res.status(400).json({
          message: "Нельзя импортировать шаблон сам в себя",
        });
      }

      const result = await this.model.copyTemplateContent(
        sourceTemplateId,
        targetTemplateId
      );

      res.json(result);
    } catch (err) {
      console.error("Ошибка контроллера:", err);
      res.status(500).json({ message: err.message });
    }
  }

  async getChangeableValues(req, res) {
    try {
      const { ids, rowName } = req.query;
      console.log(ids, rowName);

      if (!ids || !rowName) {
        return res.status(400).json({
          message: "Нет необходимых параметров",
        });
      }

      const result = await this.model.getChangeableValues(ids, rowName);

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = RpdProfileTemplatesController;
