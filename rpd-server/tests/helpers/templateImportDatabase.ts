import type { Pool } from "pg";
import type { RpdProfileTemplateRow } from "../../app/types/db.ts";
import { USER_ROLES } from "../../app/models/constants.ts";

type User = { id: number; role: number; is_active: boolean; name: string; fullname: { surname: string } };
type Profile = RpdProfileTemplateRow & Record<string, unknown>;
type Exchange = { id: number; id_rpd_complect: number; discipline: string; semester: number | null; record_type: string | null; removed_at: string | null };
type Status = { id: number; id_profile_template: number; id_1c_template: number | null; current_status: string; history: unknown[] };
type Assignment = { user_id: number; template_id: number; state: string; updated_at: string };
type State = { users: User[]; profiles: Profile[]; exchange: Exchange[]; statuses: Status[]; assignments: Assignment[]; owners: { complect_id: number; user_id: number }[]; complects: { id: number; uuid: string; year: number; direction: string; profile: string }[] };

export const rop = { id: 7, role: USER_ROLES.ROP, userName: "rop" };
export const teacher = { id: 8, role: USER_ROLES.TEACHER, userName: "teacher" };
export const admin = { id: 11, role: USER_ROLES.ADMIN, userName: "admin" };

export function profile(id: number, complectId: number): Profile {
  return { id, public_id: `rpd-${id}`, id_rpd_complect: complectId, disciplins_name: "Программирование", department: `Кафедра ${id}`,
    goals: `Цель ${id}`, place: `Место ${id}`, semester: 1, certification: `Аттестация ${id}`, place_more_text: `Текст ${id}`,
    competencies: { sentinel: id }, zet: id, content: { first: { theme: `Тема ${id}`, control: 2, lectures: 4 }, __attestation__: { theme: "Аттестация", control: 36 } },
    study_load: { lectures: id }, control_load: { control: id }, content_more_text: `Дополнение ${id}`,
    content_template_more_text: `Шаблон ${id}`, methodological_support_template: `Методика ${id}`,
    assessment_tools_template: `ФОС ${id}`, assessment_tools_questions: { sentinel: id }, textbook: [`Книга ${id}`], additional_textbook: [`Доп. книга ${id}`],
    professional_information_resources: `Ресурс ${id}`, software: `ПО ${id}`, logistics_template: `МТО ${id}`, field_edits: {} };
}

// Адаптер только внешнего SQL-I/O. Исполняются настоящие сервисы/контроллеры и
// проверки прав; этот double НЕ доказывает PostgreSQL SQL, FK и блокировки.
// Любой незнакомый запрос падает; замены применяются по полям фактического UPDATE.
export function templateDatabase() {
  let state: State = {
    users: [[7, USER_ROLES.ROP], [8, USER_ROLES.TEACHER], [9, USER_ROLES.TEACHER], [10, USER_ROLES.TEACHER], [11, USER_ROLES.ADMIN], [12, USER_ROLES.TEACHER]].map(([id, role]) => ({ id, role, is_active: id !== 10, name: `user${id}`, fullname: { surname: `Фамилия${id}` } })),
    profiles: [profile(10, 1), profile(20, 2)],
    exchange: [{ id: 100, id_rpd_complect: 1, discipline: "  ПРОГРАММИРОВАНИЕ  ", semester: 1, record_type: "1.О", removed_at: null }, { id: 200, id_rpd_complect: 2, discipline: "Программирование", semester: 1, record_type: "1.О", removed_at: null }],
    statuses: [{ id: 1, id_profile_template: 10, id_1c_template: 100, current_status: "created", history: [] }, { id: 2, id_profile_template: 20, id_1c_template: 200, current_status: "on_teacher", history: [] }],
    assignments: [{ user_id: 8, template_id: 20, state: "in_progress", updated_at: "2026-01-01" }],
    owners: [{ complect_id: 2, user_id: 7 }],
    complects: [{ id: 1, uuid: "source", year: 2026, direction: "09.03.01", profile: "Источник" }, { id: 2, uuid: "target", year: 2026, direction: "09.03.02", profile: "Цель" }],
  };
  let transaction: State | undefined;
  let writes = 0;
  let failAt = Infinity;
  let clock = 0;
  const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
  async function query(sql: string, values: unknown[] = [], connected = false) {
    const text = sql.replace(/\s+/g, " ").trim();
    if (text === "BEGIN") { transaction = structuredClone(state); return result([]); }
    if (text === "COMMIT") { state = transaction!; transaction = undefined; return result([]); }
    if (text === "ROLLBACK") { transaction = undefined; return result([]); }
    const db = connected && transaction ? transaction : state;
    const user = (id: unknown) => db.users.find((row) => row.id === id);
    const part = (id: number) => db.assignments.filter((row) => row.template_id === id).map((row) => ({ templateId: id, userId: row.user_id, state: row.state, updatedAt: row.updated_at, name: user(row.user_id)!.name, fullname: user(row.user_id)!.fullname, isActive: user(row.user_id)!.is_active }));
    const owns = (templateId: unknown, userId: unknown) => db.owners.some((row) => row.user_id === userId && row.complect_id === db.profiles.find((p) => p.id === templateId)?.id_rpd_complect);
    if (text.startsWith("SELECT EXISTS") && text.includes("AS participant")) return result([{ exists: db.profiles.some((p) => p.id === values[0]), active: Boolean(user(values[1])?.is_active), owner: owns(values[0], values[1]), participant: db.assignments.some((a) => a.template_id === values[0] && a.user_id === values[1] && user(a.user_id)?.is_active) }]);
    if (text.startsWith("SELECT EXISTS") && text.includes("AS assigned")) return result([{ assigned: db.assignments.some((a) => a.template_id === values[0] && a.user_id === values[1]) }]);
    if (text.startsWith("SELECT EXISTS") && text.includes("AS owner")) return result([{ exists: db.complects.some((c) => c.id === values[0]), owner: db.owners.some((o) => o.complect_id === values[0] && o.user_id === values[1]), active: Boolean(user(values[1])?.is_active) }]);
    if (text.startsWith("SELECT EXISTS")) return result([{ active: Boolean(user(values[0])?.is_active) }]);
    if (text.includes("AS owner") && text.includes("AS active")) return result([{ owner: owns(values[0], values[1]), active: Boolean(user(values[1])?.is_active) }]);
    if (text.endsWith("FOR UPDATE") && !text.startsWith("SELECT id,current_status")) return result([]); // Конкуренция — приёмка на настоящем PG.
    if (text.startsWith("SELECT id FROM rpd_profile_templates WHERE id::text") || text.startsWith("SELECT id,id_rpd_complect FROM rpd_profile_templates")) return result(db.profiles.filter((p) => String(p.id) === String(values[0]) || p.public_id === values[0]));
    if (text.startsWith("SELECT id FROM rpd_complects WHERE id::text")) return result(db.complects.filter((c) => String(c.id) === String(values[0]) || c.uuid === values[0]));
    if (text.startsWith("SELECT p.*,ts.current_status")) return result(db.profiles.filter((p) => p.id === values[0]).map((p) => {
      const status = db.statuses.find((s) => s.id_profile_template === p.id);
      const exchange = db.exchange.find((e) => e.id === status?.id_1c_template);
      return { ...p, current_status: status?.current_status ?? null, exchange_id: exchange?.id ?? null, removed_at: exchange?.removed_at ?? null };
    }));
    if (text.includes("'complect',to_jsonb(c)")) return result([{ state: {
      complect: db.complects.find((c) => c.id === values[0]), exchange: db.exchange.filter((e) => e.id_rpd_complect === values[0]),
      templates: db.profiles.filter((p) => p.id_rpd_complect === values[0] && (values[1] == null || p.id === values[1])).map((p) => ({ id: p.id, edits: p.field_edits, status: db.statuses.find((s) => s.id_profile_template === p.id), participants: db.assignments.filter((a) => a.template_id === p.id) })),
    } }]);
    if (text.startsWith("SELECT c.id,c.uuid")) return result(db.complects.filter((c) => c.id !== values[0]).map((c) => ({ ...c, templates: db.profiles.filter((p) => p.id_rpd_complect === c.id && (values[1] == null || db.assignments.some((a) => a.template_id === p.id && a.user_id === values[1]))).map((p) => ({ id: p.id, public_id: p.public_id, disciplins_name: p.disciplins_name, semester: p.semester, record_type: db.exchange.find((e) => e.id === db.statuses.find((s) => s.id_profile_template === p.id)?.id_1c_template)?.record_type ?? null, status: db.statuses.find((s) => s.id_profile_template === p.id)?.current_status ?? "created", participants: part(p.id) })) })).filter((c) => values[1] == null || c.templates.length));
    if (text.includes("FROM information_schema.columns")) return result(Object.keys(profile(10, 1)).map((column_name) => ({ column_name })));
    if (text.startsWith("SELECT e.id AS exchange_id")) return result(db.exchange.filter((e) => e.id_rpd_complect === values[0] && !e.removed_at).map((e) => {
      const status = db.statuses.find((s) => s.id_1c_template === e.id);
      return { exchange_id: e.id, discipline: e.discipline, semester: e.semester, record_type: e.record_type, template_id: status?.id_profile_template ?? null, current_status: status?.current_status ?? null };
    }));
    if (text.startsWith("UPDATE rpd_profile_templates")) {
      if (++writes === failAt) throw new Error("synthetic write failure");
      if (text.startsWith("UPDATE rpd_profile_templates p SET") && !text.includes("FROM rpd_profile_templates s")) {
        const fields = values.at(-1) as string[];
        const target = db.profiles.find((p) => p.id === values.at(-3))!;
        for (const [index, field] of fields.entries()) target[field] = field === "content" ? JSON.parse(String(values[index])) : structuredClone(values[index]);
        for (const field of fields) target.field_edits[field] = { userId: Number(values.at(-2)), at: `2026-11-04T00:00:${String(++clock).padStart(2, "0")}.000000Z` };
        return result([structuredClone(target)]);
      }
      const target = db.profiles.find((p) => p.id === values[1])!;
      const fields = values[3] as string[];
      if (text.includes("FROM rpd_profile_templates s")) {
        const source = db.profiles.find((p) => p.id === values[0])!;
        for (const match of text.matchAll(/(\w+)=s\.(\w+)/g)) target[match[1]] = structuredClone(source[match[2]]);
      } else if (text.includes("SET content=$1")) target.content = JSON.parse(String(values[0]));
      else throw new Error(`Неподдерживаемая запись: ${text}`);
      for (const field of fields) target.field_edits[field] = { userId: Number(values[2]), at: `2026-11-04T00:00:${String(++clock).padStart(2, "0")}.000000Z` };
      return result([structuredClone(target)]);
    }
    if (text.startsWith("SELECT tt.")) return result(Array.isArray(values[0]) ? (values[0] as number[]).flatMap(part) : part(Number(values[0])));
    if (text.startsWith("SELECT id_profile_template,current_status,history")) return result(db.statuses.filter((s) => (values[0] as number[]).includes(s.id_profile_template)));
    if (text.includes("JOIN users actor")) return result(db.profiles.filter((p) => (values[0] as number[]).includes(p.id) && (user(values[1])?.role === USER_ROLES.ADMIN || owns(p.id, values[1]))));
    if (text.startsWith("INSERT INTO template_status")) return result([]);
    if (text.startsWith("SELECT id,current_status FROM template_status")) return result(db.statuses.filter((s) => s.id_profile_template === values[0]));
    if (text.startsWith("UPDATE template_status")) {
      if (++writes === failAt) throw new Error("synthetic write failure");
      const status = db.statuses.find((s) => s.id === values[2])!;
      status.current_status = String(values[0]);
      status.history.push(...JSON.parse(String(values[1])));
      return result([]);
    }
    if (text.startsWith("INSERT INTO teacher_templates")) {
      if (++writes === failAt) throw new Error("synthetic write failure");
      db.assignments.push({ user_id: Number(values[0]), template_id: Number(values[1]), state: "assigned", updated_at: "2026-11-04" });
      return result([]);
    }
    if (text.startsWith("DELETE FROM teacher_templates")) {
      if (++writes === failAt) throw new Error("synthetic write failure");
      db.assignments = db.assignments.filter((a) => a.template_id !== values[0] || !(values[1] as number[]).includes(a.user_id));
      return result([]);
    }
    if (text.includes("FROM users WHERE id")) return result(db.users.filter((u) => Array.isArray(values[0]) ? (values[0] as number[]).includes(u.id) : u.id === values[0]));
    const preview = /^SELECT (\w+),\s*id,\s*public_id FROM/.exec(text);
    if (preview) return result(db.profiles.filter((p) => (values[0] as number[]).includes(p.id)).map((p) => ({ id: p.id, public_id: p.public_id, [preview[1]]: p[preview[1]] })));
    throw new Error(`Не поддерживается адаптером: ${text}`);
  }
  const db = { query: (sql: string, values?: unknown[]) => query(sql, values), connect: async () => ({ query: (sql: string, values?: unknown[]) => query(sql, values, true), release: () => {} }) } as unknown as Pool;
  return { db, get state() { return state; }, failWriteAt(value: number) { writes = 0; failAt = value; } };
}
