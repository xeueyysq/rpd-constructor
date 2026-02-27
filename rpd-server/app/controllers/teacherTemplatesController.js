const TeacherTemplates = require("../models/teacher_templates");
const RpdProfileTemplates = require("../models/rpd_profile_templates");

class TeacherTemplatesController {
  constructor(pool) {
    this.pool = pool;
    this.model = new TeacherTemplates(pool);
    this.templatesModel = new RpdProfileTemplates(pool);
  }

  async bindTemplateWithTeacher(req, res) {
    try {
      const payload = req.body?.params || req.body;
      const { id, teacher, teachers, userName } = payload;
      const numericId = await this.templatesModel.resolveTemplateId(id);
      if (numericId == null) {
        return res.status(404).json({ message: "Шаблон не найден" });
      }
      const record = await this.model.bindTemplateWithTeacher(
        numericId,
        teacher,
        userName,
        teachers
      );
      res.json(record);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }

  async findTeacherTemplates(req, res) {
    try {
      const { userName } = req.body;
      const record = await this.model.findTeacherTemplates(userName);
      res.json(record);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }

  async setTemplateStatus(req, res) {
    try {
      const { id, userName, status } = req.body;
      const numericId = await this.templatesModel.resolveTemplateId(id);
      if (numericId == null) {
        return res.status(404).json({ message: "Шаблон не найден" });
      }
      const record = await this.model.setTemplateStatus(
        numericId,
        userName,
        status
      );
      res.json(record);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = TeacherTemplatesController;
