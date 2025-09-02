const TeacherTemplates = require("../models/teacher_templates");

class TeacherTemplatesController {
  constructor(pool) {
    this.model = new TeacherTemplates(pool);
  }

  async bindTemplateWithTeacher(req, res) {
    try {
      const { id, teacher, userName } = req.body;
      const record = await this.model.bindTemplateWithTeacher(
        id,
        teacher,
        userName
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
      const record = await this.model.setTemplateStatus(id, userName, status);
      res.json(record);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = TeacherTemplatesController;
