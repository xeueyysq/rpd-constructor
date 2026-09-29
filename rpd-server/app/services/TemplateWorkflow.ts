import type { Pool, PoolClient } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import { pool } from "../../config/db.ts";
import { Conflict, Forbidden, NotFound, Unprocessable } from "../utils/Errors.ts";
import { ASSIGNABLE_TEACHER_ROLES, USER_ROLES } from "../models/constants.ts";
import { formatShortName, fullnameText } from "../modules/teacherNames.ts";
import { allowedActions, decide, deriveStatus, type DecisionInput, type Participant, type TemplateStatus, type WorkflowAction, type ParticipationState } from "../modules/templateWorkflow.ts";
import TemplateAccess from "./TemplateAccess.ts";

type Database = Pool | PoolClient;
type ParticipantRow = Participant & { fullname: unknown; name: string; updatedAt: Date };
type StatusRow = { id: number; current_status: TemplateStatus };
type TemplateRow = { id: number; id_rpd_complect: number };
type SnapshotStatusRow = { id_profile_template: number; current_status: TemplateStatus };
type SnapshotParticipantRow = ParticipantRow & { templateId: number };
type WorkflowSnapshot = { templateId: number; status: TemplateStatus; participants: Array<{ userId: number; fullname: string; state: ParticipationState; isActive: boolean; updatedAt: Date }>; progress: { done: number; total: number }; allowedActions: WorkflowAction[]; canEditTeachers: boolean };

export function buildSnapshots(templateIds: number[], statuses: SnapshotStatusRow[], participants: SnapshotParticipantRow[], managerIds: ReadonlySet<number>, actorId: number): Map<number, WorkflowSnapshot> {
  const statusesById = new Map(statuses.map((row) => [row.id_profile_template, row.current_status]));
  const participantsById = new Map<number, SnapshotParticipantRow[]>();
  for (const participant of participants) {
    const group = participantsById.get(participant.templateId) ?? [];
    group.push(participant);
    participantsById.set(participant.templateId, group);
  }
  return new Map(templateIds.map((id) => {
    const status = statusesById.get(id) ?? "created";
    const assigned = participantsById.get(id) ?? [];
    const active = assigned.filter((part) => part.isActive);
    const canManage = managerIds.has(id);
    return [id, { templateId: id, status, participants: assigned.map((part) => ({ userId: part.userId, fullname: fullnameText(part.fullname) || part.name, state: part.state, isActive: part.isActive, updatedAt: part.updatedAt })), progress: { done: active.filter((part) => part.state === "done").length, total: active.length }, allowedActions: allowedActions(status, assigned, actorId, canManage), canEditTeachers: canManage && status !== "ready" }];
  }));
}

export default class TemplateWorkflow {
  private readonly database: Pool;
  constructor(database: Pool = pool) { this.database = database; }

  async resolveId(db: Database, identifier: unknown): Promise<TemplateRow> {
    if (typeof identifier !== "string" && typeof identifier !== "number") throw new Unprocessable("Некорректный ID шаблона");
    const { rows } = await db.query<TemplateRow>("SELECT id,id_rpd_complect FROM rpd_profile_templates WHERE id::text=$1 OR public_id=$1 LIMIT 1", [String(identifier)]);
    if (!rows[0]) throw new NotFound("Шаблон не найден");
    return rows[0];
  }

  async participants(db: Database, id: number): Promise<ParticipantRow[]> {
    const { rows } = await db.query<ParticipantRow>(`SELECT tt.user_id AS "userId",tt.state,u.name,u.fullname,u.is_active AS "isActive",tt.updated_at AS "updatedAt" FROM teacher_templates tt JOIN users u ON u.id=tt.user_id WHERE tt.template_id=$1 ORDER BY tt.id`, [id]);
    return rows;
  }

  async status(db: Database, id: number, lock = false): Promise<StatusRow> {
    await db.query("INSERT INTO template_status(id_profile_template,current_status,history) VALUES($1,'created',$2::jsonb) ON CONFLICT(id_profile_template) WHERE id_profile_template IS NOT NULL DO NOTHING", [id, JSON.stringify([{ date: new Date().toISOString(), status: "created", user: "Система", action: "recovery" }])]);
    const { rows } = await db.query<StatusRow>(`SELECT id,current_status FROM template_status WHERE id_profile_template=$1${lock ? " FOR UPDATE" : ""}`, [id]);
    if (!rows[0]) throw new NotFound("Статус шаблона не найден");
    return rows[0];
  }

  private async assignParticipant(client: PoolClient, templateId: number, input: DecisionInput) {
    const decision = decide(input);
    await client.query("INSERT INTO teacher_templates(user_id,template_id,state) VALUES($1,$2,'assigned')", [input.targetUserId, templateId]);
    return decision;
  }

  async snapshots(db: Database, templateIds: number[], actor: UserClaims, canManageAll = false): Promise<Map<number, WorkflowSnapshot>> {
    if (!templateIds.length) return new Map();
    const [statuses, participants, managers] = await Promise.all([
      db.query<SnapshotStatusRow>("SELECT id_profile_template,current_status FROM template_status WHERE id_profile_template=ANY($1::int[])", [templateIds]),
      db.query<SnapshotParticipantRow>(`SELECT tt.template_id AS "templateId",tt.user_id AS "userId",tt.state,u.name,u.fullname,u.is_active AS "isActive",tt.updated_at AS "updatedAt" FROM teacher_templates tt JOIN users u ON u.id=tt.user_id WHERE tt.template_id=ANY($1::int[]) ORDER BY tt.id`, [templateIds]),
      canManageAll ? Promise.resolve(null) : db.query<{ id: number }>(`SELECT rpt.id FROM rpd_profile_templates rpt JOIN users actor ON actor.id=$2 AND actor.is_active LEFT JOIN user_complect uc ON uc.complect_id=rpt.id_rpd_complect AND uc.user_id=actor.id WHERE rpt.id=ANY($1::int[]) AND ($3::int=$4::int OR ($3::int=$5::int AND uc.user_id IS NOT NULL))`, [templateIds, actor.id, actor.role, USER_ROLES.ADMIN, USER_ROLES.ROP]),
    ]);
    const managerIds = new Set(canManageAll ? templateIds : managers?.rows.map((row) => row.id) ?? []);
    return buildSnapshots(templateIds, statuses.rows, participants.rows, managerIds, actor.id);
  }

  async snapshot(db: Database, id: number, actor: UserClaims) {
    const snapshot = (await this.snapshots(db, [id], actor)).get(id);
    if (!snapshot) throw new NotFound("Шаблон не найден");
    return snapshot;
  }

  async get(identifier: unknown, actor: UserClaims) {
    const template = await this.resolveId(this.database, identifier);
    await TemplateAccess.assertTemplate(this.database, actor, template.id, "read");
    return this.snapshot(this.database, template.id, actor);
  }

  async apply(identifier: unknown, actor: UserClaims, action: WorkflowAction, targetUserId?: number, comment?: string) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const template = await this.resolveId(client, identifier);
      await client.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [template.id_rpd_complect]);
      await client.query("SELECT id FROM users WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE", [[actor.id, ...(targetUserId === undefined ? [] : [targetUserId])]]);
      const status = await this.status(client, template.id, true);
      await TemplateAccess.assertTemplate(client, actor, template.id, ["assign", "unassign", "accept", "refine"].includes(action) ? "manage" : "read");
      const canManage = await TemplateAccess.canManageTemplate(client, actor, template.id);
      const participants = await this.participants(client, template.id);
      const { rows: actorRows } = await client.query<{ fullname: unknown }>("SELECT fullname FROM users WHERE id=$1", [actor.id]);
      let target: { id: number; is_active: boolean; role: number } | undefined;
      if (action === "assign" || action === "unassign") {
        if (!Number.isInteger(targetUserId)) throw new Unprocessable("Не указан userId");
        const { rows } = await client.query<{ id: number; is_active: boolean; role: number }>("SELECT id,is_active,role FROM users WHERE id=$1", [targetUserId]);
        target = rows[0];
        if (!target) throw new NotFound("Пользователь не найден");
      }
      const input: DecisionInput = { current: status.current_status, participants, action, actorId: actor.id, actorRole: actor.role, canManage, userName: formatShortName(actorRows[0]?.fullname) || actor.userName, targetUserId, targetIsActive: target?.is_active, targetRole: target?.role, comment };
      const decision = action === "assign" ? await this.assignParticipant(client, template.id, input) : decide(input);
      if (action === "unassign") await client.query("DELETE FROM teacher_templates WHERE user_id=$1 AND template_id=$2", [targetUserId, template.id]);
      if (["start", "finish", "reopen"].includes(action)) await client.query("UPDATE teacher_templates SET state=$1,updated_at=NOW() WHERE user_id=$2 AND template_id=$3", [decision.participants.find((part) => part.userId === actor.id)?.state, actor.id, template.id]);
      if (action === "refine") await client.query("UPDATE teacher_templates SET state='assigned',updated_at=NOW() WHERE template_id=$1 AND state='done'", [template.id]);
      await client.query("UPDATE template_status SET current_status=$1,history=COALESCE(history,'[]'::jsonb)||$2::jsonb WHERE id=$3", [decision.status, JSON.stringify([decision.event]), status.id]);
      const result = await this.snapshot(client, template.id, actor);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async myTemplates(actor: UserClaims) {
    const { rows } = await this.database.query<{ id: number; public_id: string; disciplins_name: string | null; faculty: string | null; direction: string | null; profile: string | null; education_level: string | null; education_form: string | null; year: number | null; myState: ParticipationState }>(`
      SELECT rpt.id,rpt.public_id,rpt.disciplins_name,rc.faculty,rc.direction,rc.profile,rc.education_level,rc.education_form,rc.year,tt.state AS "myState"
      FROM teacher_templates tt JOIN users u ON u.id=tt.user_id JOIN rpd_profile_templates rpt ON rpt.id=tt.template_id JOIN rpd_complects rc ON rc.id=rpt.id_rpd_complect
      WHERE tt.user_id=$1 AND u.is_active ORDER BY rpt.id`, [actor.id]);
    const snapshots = await this.snapshots(this.database, rows.map((row) => row.id), actor);
    return rows.map((row) => ({ ...row, ...snapshots.get(row.id) }));
  }

  async assignableTeachers(actor: UserClaims) {
    if (actor.role !== USER_ROLES.ADMIN && actor.role !== USER_ROLES.ROP) throw new Forbidden("Нет доступа к списку преподавателей");
    const { rows: active } = await this.database.query<{ is_active: boolean }>("SELECT is_active FROM users WHERE id=$1", [actor.id]);
    if (!active[0]?.is_active) throw new Forbidden("Пользователь неактивен");
    const { rows } = await this.database.query<{ id: number; name: string; fullname: unknown }>("SELECT id,name,fullname FROM users WHERE is_active AND role=ANY($1::int[]) ORDER BY id", [ASSIGNABLE_TEACHER_ROLES]);
    return rows.map((row) => ({ id: row.id, fullname: fullnameText(row.fullname) || row.name }));
  }

  async recomputeForUser(client: PoolClient, userId: number) {
    const { rows } = await client.query<{ template_id: number }>("SELECT template_id FROM teacher_templates WHERE user_id=$1 ORDER BY template_id", [userId]);
    for (const row of rows) {
      const status = await this.status(client, row.template_id, true);
      if (status.current_status === "ready") continue;
      const next = deriveStatus(status.current_status, await this.participants(client, row.template_id));
      if (next !== status.current_status) await client.query("UPDATE template_status SET current_status=$1,history=COALESCE(history,'[]'::jsonb)||$2::jsonb WHERE id=$3", [next, JSON.stringify([{ date: new Date().toISOString(), status: next, user: "Система", action: "activation" }]), status.id]);
    }
  }

  async createFrom1c(exchangeId: number, complectId: number, actor: UserClaims, teacherIds: number[]) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const { rows: complects } = await client.query<{ id: number }>("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [complectId]);
      if (!complects[0]) throw new NotFound("Комплект не найден");
      await client.query("SELECT id FROM users WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE", [[actor.id, ...teacherIds]]);
      await TemplateAccess.assertComplect(client, actor, complectId);
      const { rows: exchange } = await client.query<{ id: number; discipline: string | null; department: string | null; place: string | null; semester: number | null; zet: number | null; study_load: unknown; control_load: unknown }>("SELECT id,discipline,department,place,semester,zet,study_load,control_load FROM rpd_1c_exchange WHERE id=$1 AND id_rpd_complect=$2 FOR UPDATE", [exchangeId, complectId]);
      const row = exchange[0];
      if (!row) throw new NotFound("Строка 1С не найдена в комплекте");
      if (!row.discipline?.trim()) throw new Unprocessable("Не указана дисциплина");
      const { rows: statuses } = await client.query<{ id: number; id_profile_template: number | null }>("SELECT id,id_profile_template FROM template_status WHERE id_1c_template=$1 FOR UPDATE", [exchangeId]);
      if (statuses[0]?.id_profile_template) throw new Conflict("Шаблон уже создан");
      const { rows: inserted } = await client.query<{ id: number }>(`
        INSERT INTO rpd_profile_templates(id_rpd_complect,disciplins_name,department,place,semester,competencies,zet,study_load,control_load)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb) RETURNING id
      `, [complectId, row.discipline, row.department, row.place, row.semester, "{}", row.zet, JSON.stringify(row.study_load), JSON.stringify(row.control_load ?? {})]);
      const id = inserted[0].id;
      const { rows: author } = await client.query<{ fullname: unknown }>("SELECT fullname FROM users WHERE id=$1", [actor.id]);
      const user = formatShortName(author[0]?.fullname) || actor.userName;
      const createdEvent = { date: new Date().toISOString(), status: "created", user, userId: actor.id, action: "create" };
      if (statuses[0]) await client.query("UPDATE template_status SET id_profile_template=$1,current_status='created',history=COALESCE(history,'[]'::jsonb)||$2::jsonb WHERE id=$3", [id, JSON.stringify([createdEvent]), statuses[0].id]);
      else await client.query("INSERT INTO template_status(id_1c_template,id_profile_template,current_status,history) VALUES($1,$2,'created',$3::jsonb)", [exchangeId, id, JSON.stringify([createdEvent])]);
      let participants: Participant[] = [];
      let status: TemplateStatus = "created";
      for (const userId of teacherIds) {
        const { rows: users } = await client.query<{ role: number; is_active: boolean }>("SELECT role,is_active FROM users WHERE id=$1", [userId]);
        if (!users[0]) throw new NotFound("Пользователь не найден");
        const decision = await this.assignParticipant(client, id, { current: status, participants, action: "assign", actorId: actor.id, actorRole: actor.role, canManage: true, userName: user, targetUserId: userId, targetIsActive: users[0].is_active, targetRole: users[0].role });
        await client.query("UPDATE template_status SET current_status=$1,history=COALESCE(history,'[]'::jsonb)||$2::jsonb WHERE id_profile_template=$3", [decision.status, JSON.stringify([decision.event]), id]);
        participants = decision.participants;
        status = decision.status;
      }
      const snapshot = await this.snapshot(client, id, actor);
      await client.query("COMMIT");
      return snapshot;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}
