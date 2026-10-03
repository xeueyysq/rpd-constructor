import type { Pool } from "pg";
import RpdComplects from "../models/rpd_complects.ts";
import Rpd1cExchange from "../models/rpd_1c_exchange.ts";
import type { UserClaims } from "../types/express.d.ts";
import TemplateAccess from "./TemplateAccess.ts";
import TemplateWorkflow from "./TemplateWorkflow.ts";
import { matchTeacherNames, splitNames } from "../modules/teacherNames.ts";
import { ASSIGNABLE_TEACHER_ROLES } from "../models/constants.ts";
import { statusChangedAt } from "../modules/templateWorkflow.ts";

async function findRpd(pool: Pool, complectId: unknown, actor: UserClaims) {
  const rpdComplects = new RpdComplects(pool);
  const rpd1cExchange = new Rpd1cExchange(pool);

  const complectMeta = await rpdComplects.findRpdComplectMeta(complectId);

  if (!complectMeta || !complectMeta.id) {
    throw new Error("Комплект не найден");
  }

  const numericComplectId = complectMeta.id;
  await TemplateAccess.assertComplect(pool, actor, numericComplectId);
  const complectTemplates = await rpd1cExchange.findRpd(numericComplectId);
  const { rows: users } = await pool.query<{ id: number; fullname: unknown }>("SELECT id,fullname FROM users WHERE is_active AND role=ANY($1::int[])", [ASSIGNABLE_TEACHER_ROLES]);
  const workflow = new TemplateWorkflow(pool);
  const snapshots = await workflow.snapshots(pool, complectTemplates.flatMap((row) => row.id_profile_template === null ? [] : [row.id_profile_template]), actor, true);
  const templates = complectTemplates.map(({ teachers, status_history, ...row }) => {
    const teacherHints = matchTeacherNames(splitNames(teachers), users).map(({ name, userId }) => ({ name, userId }));
    const snapshot = row.id_profile_template ? snapshots.get(row.id_profile_template) : null;
    return { ...row, status: snapshot?.status ?? row.status, statusChangedAt: snapshot ? snapshot.statusChangedAt : statusChangedAt(status_history, row.status), participants: snapshot?.participants ?? [], progress: snapshot?.progress ?? { done: 0, total: 0 }, allowedActions: snapshot?.allowedActions ?? [], canEditTeachers: snapshot?.canEditTeachers ?? true, teacherHints };
  });
  return {
    ...complectMeta,
    templates,
  };
}

export { findRpd };
