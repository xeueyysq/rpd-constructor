import type { PoolClient } from "pg";
import { USER_ROLES, ASSIGNABLE_TEACHER_ROLES } from "../models/constants.ts";
import { canonicalTeacherLabel, fullnameText, splitNames, teacherPerson } from "./teacherNames.ts";

export type TeacherImportResult = {
  created: number;
  unresolved: { name: string; reason: "incomplete" | "ambiguous" | "unavailable" }[];
};

// Вызывается только с полным доверенным ответом сервера / проверенным manifest.
// Транзакцией владеет вызывающий create/apply; здесь нет отдельных commit.
export async function importTeacherCards(client: PoolClient, names: string[]): Promise<TeacherImportResult> {
  const result: TeacherImportResult = { created: 0, unresolved: [] };
  const people = new Map<string, NonNullable<ReturnType<typeof teacherPerson>>>();
  for (const name of splitNames(names)) {
    const label = canonicalTeacherLabel(name);
    if (!label) continue;
    const person = teacherPerson(label);
    if (!person) {
      result.unresolved.push({ name: label, reason: "incomplete" });
      continue;
    }
    if (!people.has(person.key)) people.set(person.key, person);
  }
  const ordered = [...people.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const linkedIds = new Map<string, number | null>();
  // Одинаковый полный порядок блокировок предотвращает deadlock пересекающихся импортов.
  for (const person of ordered) {
    await client.query(`INSERT INTO teacher_source_cards (source, label_key, label)
      VALUES ('1c-fullname-v1', $1, $2) ON CONFLICT (source, label_key) DO NOTHING`, [person.key, person.label]);
    const { rows: links } = await client.query<{ user_id: number | null }>(
      `SELECT user_id FROM teacher_source_cards WHERE source='1c-fullname-v1' AND label_key=$1 FOR UPDATE`, [person.key]);
    linkedIds.set(person.key, links[0].user_id);
  }
  if (!ordered.length) return result;
  // Читаем после ВСЕХ блокировок: параллельный импорт уже мог создать карточку.
  // Все роли и активности участвуют в точном сопоставлении, без инициалов.
  type Candidate = { id: number; fullname: unknown; role: number; is_active: boolean };
  const { rows: users } = await client.query<Candidate>("SELECT id, fullname, role, is_active FROM users");
  const usersByKey = new Map<string, Candidate[]>();
  for (const user of users) {
    const key = teacherPerson(typeof user.fullname === "string" ? user.fullname : fullnameText(user.fullname))?.key;
    if (key) usersByKey.set(key, [...usersByKey.get(key) ?? [], user]);
  }
  for (const person of ordered) {
    const matches = usersByKey.get(person.key) ?? [];
    const linkedId = linkedIds.get(person.key);
    // Если ФИО связанного пользователя изменили, не угадываем новую личность.
    if (matches.length > 1 || (linkedId != null && (matches.length !== 1 || linkedId !== matches[0].id))) {
      result.unresolved.push({ name: person.label, reason: "ambiguous" });
      continue;
    }
    let user = matches[0];
    if (!user) {
      const { rows } = await client.query<{ id: number; fullname: unknown; role: number; is_active: boolean }>(
        `INSERT INTO users (name, password, role, fullname, is_active) VALUES (NULL, NULL, $1, $2, TRUE)
         RETURNING id, fullname, role, is_active`, [USER_ROLES.TEACHER, person.fullname]);
      user = rows[0];
      result.created++;
    }
    await client.query(`UPDATE teacher_source_cards SET user_id=$2 WHERE source='1c-fullname-v1' AND label_key=$1`, [person.key, user.id]);
    if (!user.is_active || !ASSIGNABLE_TEACHER_ROLES.includes(user.role)) {
      result.unresolved.push({ name: person.label, reason: "unavailable" });
    }
  }
  return result;
}
