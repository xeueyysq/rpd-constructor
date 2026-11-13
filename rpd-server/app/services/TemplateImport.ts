import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import { USER_ROLES } from "../models/constants.ts";
import TemplateImportModel, { type ImportTemplate } from "../models/template_import.ts";
import TemplateAccess from "./TemplateAccess.ts";
import { resolveComplect, resolveTemplate } from "../middleware/templateAuthorization.ts";
import { importMatchKey, isTemplateImportField, type TemplateImportField } from "../modules/templateImport.ts";
import { withEditorNames } from "../modules/fieldEdits.ts";
import { formatDisciplineName } from "../modules/disciplineNames.ts";
import { Conflict, Forbidden, NotFound, Unprocessable } from "../utils/Errors.ts";
import type { CopyTemplateResponse, ImportComplectEntry, ImportComplectResponse, ImportSkipReason, ImportSourcesResponse } from "../types/templateImport.ts";

type Database = Pool | PoolClient;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}

export default class TemplateImport {
  private readonly database: Pool;
  constructor(database: Pool) { this.database = database; }

  private async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  private async assertActor(db: Database, actor: UserClaims) {
    if (![USER_ROLES.TEACHER, USER_ROLES.ROP, USER_ROLES.ADMIN].includes(actor.role)) throw new Forbidden("Нет доступа к импорту");
    await TemplateAccess.assertActive(db, actor);
  }

  private async target(db: Database, actor: UserClaims, id: number): Promise<ImportTemplate> {
    await this.assertActor(db, actor);
    await TemplateAccess.assertTemplate(db, actor, id, "edit");
    const target = await TemplateImportModel.template(db, id);
    if (!target) throw new NotFound("Шаблон не найден");
    if (target.current_status === "ready" || target.current_status === "closed" || target.removed_at) throw new Conflict("Шаблон закрыт для редактирования");
    return target;
  }

  private async source(db: Database, id: number, targetComplectId: number): Promise<ImportTemplate> {
    const source = await TemplateImportModel.template(db, id);
    if (!source || source.removed_at) throw new NotFound("Источник импорта не найден");
    if (source.id_rpd_complect === targetComplectId) throw new Unprocessable("Выберите источник из другого комплекта");
    return source;
  }

  private assignedOnly(actor: UserClaims, ownOnly: unknown): boolean {
    if (ownOnly !== undefined && ownOnly !== true && ownOnly !== false && ownOnly !== "true" && ownOnly !== "false")
      throw new Unprocessable("Некорректный ownOnly");
    return actor.role === USER_ROLES.TEACHER || ownOnly === true || ownOnly === "true";
  }

  private async assertSourceAssignment(db: Database, actor: UserClaims, sourceId: number, ownOnly: unknown): Promise<void> {
    if (this.assignedOnly(actor, ownOnly) && !(await TemplateImportModel.isAssigned(db, sourceId, actor.id)))
      throw new Forbidden("Источник не назначен вам");
  }

  private async revision(db: Database, complectId: number, templateId?: number) {
    const state = await TemplateImportModel.revisionState(db, complectId, templateId);
    return createHash("sha256").update(canonical(state)).digest("hex");
  }

  private async checkRevision(db: Database, complectId: number, baseline: unknown, templateId?: number, required = false) {
    if (baseline === undefined && !required) return;
    if (typeof baseline !== "string" || !baseline) throw new Unprocessable("Укажите targetRevision");
    const current = await this.revision(db, complectId, templateId);
    if (current !== baseline) throw new Conflict({ message: "Цель импорта уже изменена. Обновите список источников", targetRevision: current });
  }

  async sources(actor: UserClaims, targetTemplateId: unknown, targetComplectId: unknown, ownOnly?: unknown): Promise<ImportSourcesResponse> {
    if ((targetTemplateId !== undefined) === (targetComplectId !== undefined)) throw new Unprocessable("Укажите ровно одну цель импорта");
    let complectId: number;
    let templateId: number | undefined;
    if (targetTemplateId !== undefined) {
      templateId = await resolveTemplate(this.database, targetTemplateId);
      complectId = (await this.target(this.database, actor, templateId)).id_rpd_complect;
    } else {
      await this.assertActor(this.database, actor);
      complectId = await resolveComplect(this.database, targetComplectId);
      await TemplateAccess.assertComplect(this.database, actor, complectId);
    }
    const targetRevision = await this.revision(this.database, complectId, templateId);
    const sources = await TemplateImportModel.sources(this.database, complectId, this.assignedOnly(actor, ownOnly) ? actor.id : undefined);
    const complects = sources.map((complect) => ({
      ...complect,
      templates: complect.templates.map((template) => ({
        ...template,
        disciplins_name: formatDisciplineName(template.disciplins_name),
      })),
    }));
    return { targetRevision, complects };
  }

  async preview(actor: UserClaims, ids: unknown, field: unknown, targetTemplateId: unknown, ownOnly?: unknown) {
    if (!isTemplateImportField(field)) throw new Unprocessable("Недопустимое поле импорта");
    const targetId = await resolveTemplate(this.database, targetTemplateId);
    const target = await this.target(this.database, actor, targetId);
    if (!(await TemplateImportModel.fields(this.database)).includes(field)) throw new Unprocessable("Поле отсутствует в схеме");
    const numericIds: number[] = [];
    for (const identifier of Array.isArray(ids) ? ids : [ids]) {
      const id = await resolveTemplate(this.database, identifier);
      await this.source(this.database, id, target.id_rpd_complect);
      await this.assertSourceAssignment(this.database, actor, id, ownOnly);
      numericIds.push(id);
    }
    return TemplateImportModel.preview(this.database, [...new Set(numericIds)], field);
  }

  async copy(actor: UserClaims, sourceIdentifier: unknown, targetIdentifier: unknown, options: { field?: unknown; baseAt?: unknown; targetRevision?: unknown; ownOnly?: unknown } = {}): Promise<CopyTemplateResponse> {
    let field: TemplateImportField | undefined;
    if (options.field !== undefined) {
      if (!isTemplateImportField(options.field)) throw new Unprocessable("Недопустимое поле импорта");
      field = options.field;
      if (!(options.baseAt === null || typeof options.baseAt === "string")) throw new Unprocessable("Укажите baseAt");
    }
    return this.transaction(async (client) => {
      const targetId = await resolveTemplate(client, targetIdentifier);
      const sourceId = await resolveTemplate(client, sourceIdentifier);
      const initialTarget = await this.target(client, actor, targetId);
      const initialSource = await this.source(client, sourceId, initialTarget.id_rpd_complect);
      this.assignedOnly(actor, options.ownOnly);
      await TemplateImportModel.lock(client, [initialTarget.id_rpd_complect, initialSource.id_rpd_complect], actor.id);
      const target = await this.target(client, actor, targetId);
      await this.source(client, sourceId, target.id_rpd_complect);
      await this.assertSourceAssignment(client, actor, sourceId, options.ownOnly);
      if (field) {
        const currentEdit = target.field_edits[field] ?? null;
        if ((currentEdit?.at ?? null) !== options.baseAt) throw new Conflict({ message: "Поле уже изменено", field, value: target[field as keyof ImportTemplate], edit: (await withEditorNames(client, currentEdit ? { [field]: currentEdit } : {}))[field] ?? null });
      } else await this.checkRevision(client, target.id_rpd_complect, options.targetRevision, targetId);
      const available = await TemplateImportModel.fields(client);
      const fields = field ? available.filter((item) => item === field) : available;
      if (!fields.length) throw new Unprocessable("Нет доступных полей импорта");
      const updated = await TemplateImportModel.replace(client, sourceId, targetId, fields, actor.id);
      if (!updated) throw new NotFound("Шаблон не найден");
      const edits = await withEditorNames(client, updated.field_edits);
      return { success: true, message: field ? `Поле ${field} успешно скопировано` : "Контентные поля успешно импортированы",
        targetTemplate: { ...updated, field_edits: edits }, ...(field ? { value: updated[field as keyof typeof updated], edit: edits[field] } : {}),
        targetRevision: await this.revision(client, target.id_rpd_complect, targetId) };
    });
  }

  async complect(actor: UserClaims, sourceIdentifier: unknown, targetIdentifier: unknown, targetRevision: unknown): Promise<ImportComplectResponse> {
    return this.transaction(async (client) => {
      await this.assertActor(client, actor);
      const targetId = await resolveComplect(client, targetIdentifier);
      await TemplateAccess.assertComplect(client, actor, targetId);
      const sourceId = await resolveComplect(client, sourceIdentifier);
      if (sourceId === targetId) throw new Unprocessable("Выберите другой комплект");
      await TemplateImportModel.lock(client, [sourceId, targetId], actor.id);
      await TemplateAccess.assertComplect(client, actor, targetId);
      await resolveComplect(client, sourceId);
      await this.checkRevision(client, targetId, targetRevision, undefined, true);
      const sources = await TemplateImportModel.exchanges(client, sourceId);
      const targets = await TemplateImportModel.exchanges(client, targetId);
      const fields = await TemplateImportModel.fields(client);
      if (!fields.length) throw new Unprocessable("Нет доступных полей импорта");
      const imported: ImportComplectResponse["imported"] = [];
      const skipped: ImportComplectResponse["skipped"] = [];
      for (const target of targets) {
        const entry: ImportComplectEntry = { targetExchangeId: target.exchange_id, targetTemplateId: target.template_id, discipline: target.discipline, semester: target.semester, record_type: target.record_type };
        const key = importMatchKey(target);
        const matches = sources.filter((row) => importMatchKey(row) === key);
        let reason: ImportSkipReason | undefined;
        if (!target.discipline?.trim() || !matches.length) reason = "missing_source";
        else if (matches.length !== 1 || targets.filter((row) => importMatchKey(row) === key).length !== 1) reason = "ambiguous";
        else if (target.template_id == null) reason = "target_missing_template";
        else if (matches[0].template_id == null) reason = "source_missing_template";
        else if (target.current_status === "ready" || target.current_status === "closed") reason = "read_only";
        if (reason) { skipped.push({ ...entry, reason }); continue; }
        await this.target(client, actor, target.template_id!);
        const updated = await TemplateImportModel.replace(client, matches[0].template_id!, target.template_id!, fields, actor.id);
        if (!updated) throw new NotFound("Цель импорта не найдена");
        imported.push({ ...entry, sourceExchangeId: matches[0].exchange_id, sourceTemplateId: matches[0].template_id! });
      }
      return { imported, skipped, counts: { imported: imported.length, skipped: skipped.length, total: targets.length }, targetRevision: await this.revision(client, targetId) };
    });
  }
}
