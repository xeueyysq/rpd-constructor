import type { Pool } from "pg";
import { withEditorNamesAndUsers, type StoredFieldEdits } from "../modules/fieldEdits.ts";
import { NotFound } from "../utils/Errors.ts";

const TTL_MS = 45_000;

export default class TemplatePresence {
  // ponytail: присутствие в памяти одного процесса; при нескольких инстансах — Redis/таблица с TTL.
  private readonly active = new Map<number, Map<number, number>>();
  private readonly db: Pool;
  private readonly now: () => number;

  constructor(db: Pool, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  private users(templateId: number): Map<number, number> {
    const now = this.now();
    for (const [id, users] of this.active) {
      for (const [userId, seenAt] of users) {
        if (now - seenAt >= TTL_MS) users.delete(userId);
      }
      if (!users.size) this.active.delete(id);
    }
    const users = this.active.get(templateId) ?? new Map<number, number>();
    this.active.set(templateId, users);
    return users;
  }

  async touch(templateId: number, userId: number) {
    const { rows } = await this.db.query<{ field_edits: StoredFieldEdits }>("SELECT field_edits FROM rpd_profile_templates WHERE id = $1", [templateId]);
    if (!rows[0]) throw new NotFound("Шаблон не найден");
    const users = this.users(templateId);
    users.set(userId, this.now());
    const otherIds = [...users.keys()].filter((id) => id !== userId);
    const { edits, names } = await withEditorNamesAndUsers(this.db, rows[0].field_edits, otherIds);
    const editors = otherIds.map((id) => ({ userId: id, fullname: names.get(id) ?? "" }))
      .sort((a, b) => a.fullname.localeCompare(b.fullname, "ru-RU"));
    return { editors, fieldEdits: edits };
  }
}
