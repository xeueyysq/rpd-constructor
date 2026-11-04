import type { Pool } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import { resolveTemplate } from "../middleware/templateAuthorization.ts";
import TemplateAccess from "./TemplateAccess.ts";
import TemplateImportModel from "../models/template_import.ts";
import { saveClearedContent } from "../models/template_content_control.ts";
import { withEditorNames } from "../modules/fieldEdits.ts";
import { Conflict, Unprocessable } from "../utils/Errors.ts";
import type { ClearTemplateControlResponse } from "../types/templateImport.ts";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export default class TemplateContentControl {
  private readonly database: Pool;
  constructor(database: Pool) { this.database = database; }

  async clear(identifier: unknown, actor: UserClaims, rowId: unknown, baseAt: unknown): Promise<ClearTemplateControlResponse> {
    if (typeof rowId !== "string" || !rowId || rowId === "__attestation__" || !(baseAt === null || typeof baseAt === "string")) throw new Unprocessable("Укажите обычную тему и baseAt");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const id = await resolveTemplate(client, identifier);
      await TemplateAccess.assertTemplate(client, actor, id, "manage");
      const initial = await TemplateImportModel.template(client, id);
      if (!initial) throw new Unprocessable("Шаблон не найден");
      await TemplateImportModel.lock(client, [initial.id_rpd_complect], actor.id);
      await TemplateAccess.assertTemplate(client, actor, id, "manage");
      const current = await TemplateImportModel.template(client, id);
      if (!current || current.current_status === "ready" || current.current_status === "closed" || current.removed_at) throw new Conflict("Шаблон закрыт для редактирования");
      const edit = current.field_edits.content ?? null;
      if ((edit?.at ?? null) !== baseAt) throw new Conflict({ message: "Содержание уже изменено", field: "content", value: current.content, edit: (await withEditorNames(client, edit ? { content: edit } : {})).content ?? null });
      const content = current.content;
      const row = record(content) && Object.hasOwn(content, rowId) ? content[rowId] : undefined;
      const control = record(row) && (typeof row.control === "number" || typeof row.control === "string") ? Number(String(row.control).replace(/\s+/g, "").replace(",", ".")) : 0;
      if (!record(content) || !record(row) || typeof row.theme !== "string" || !row.theme.trim() || !Number.isFinite(control) || control === 0) throw new Unprocessable("Можно очистить только существующий ненулевой контроль обычной темы");
      const saved = await saveClearedContent(client, id, { ...content, [rowId]: { ...row, control: 0 } }, actor.id);
      const result: ClearTemplateControlResponse = { field: "content", value: saved.content, edit: (await withEditorNames(client, saved.field_edits)).content };
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}
