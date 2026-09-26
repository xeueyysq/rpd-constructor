import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import TeacherTemplates from "../models/teacher_templates.ts";
import RpdProfileTemplates from "../models/rpd_profile_templates.ts";

class TeacherTemplatesController {
  pool: Pool;
  model: TeacherTemplates;
  templatesModel: RpdProfileTemplates;
  constructor(pool: Pool) {
    this.pool = pool;
    this.model = new TeacherTemplates(pool);
    this.templatesModel = new RpdProfileTemplates(pool);
  }

  async bindTemplateWithTeacher(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const payload = (req.body?.params || req.body) as { id: unknown; teacher: unknown; teachers: unknown; userName: string };
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
      res.status(500).json({ message: errorMessage(error) });
    }
  }

  async findTeacherTemplates(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { userName } = req.body;
      const record = await this.model.findTeacherTemplates(userName as string);
      res.json(record);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: errorMessage(error) });
    }
  }

  async setTemplateStatus(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { id, userName, status } = req.body;
      const numericId = await this.templatesModel.resolveTemplateId(id);
      if (numericId == null) {
        return res.status(404).json({ message: "Шаблон не найден" });
      }
      const record = await this.model.setTemplateStatus(
        numericId,
        userName as string,
        status as string
      );
      res.json(record);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: errorMessage(error) });
    }
  }
}

export default TeacherTemplatesController;
