import test from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import TemplateImport from "../app/services/TemplateImport.ts";
import { USER_ROLES } from "../app/models/constants.ts";

const connectionString = process.env.RPD_TEST_PG_URL;
const enabled = (() => {
  if (!connectionString) return false;
  const url = new URL(connectionString);
  if (url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/rpd_e2e")
    throw new Error("Разрешена только синтетическая БД 127.0.0.1:5433/rpd_e2e");
  return true;
})();

test("PostgreSQL: назначение источника, отзыв, ownOnly, защита полей и ревизии", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString, max: 2 });
  t.after(() => pool.end());
  const base = randomInt(500_000_000, 900_000_000);
  const ids = { teacher: base, rop: base + 1, sourceComplect: base + 10, targetComplect: base + 11,
    source: base + 20, target: base + 21, sourceAssignment: base + 30, targetAssignment: base + 31, owner: base + 40 };
  const nonce = randomBytes(6).toString("hex");
  // Изолированные синтетические строки остаются в эфемерной E2E БД до её удаления.
  await pool.query("INSERT INTO users(id,name,password,role,fullname) VALUES($1,$2,'no-login',2,'{}'::jsonb),($3,$4,'no-login',3,'{}'::jsonb)",
    [ids.teacher, `wt-${nonce}`, ids.rop, `wr-${nonce}`]);
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$5,2025,'Очная','Бакалавриат','Источник','09.03.01'),
          ($3,$4,$5,2026,'Очная','Бакалавриат','Цель','09.03.02')`,
    [ids.sourceComplect, randomUUID(), ids.targetComplect, randomUUID(), `Тест Word ${nonce}`]);
  await pool.query(`INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,goals,content,competencies,study_load,assessment_tools_template,field_edits)
    VALUES($1,$2,$3,'Синтетическая цель','Цель источника','{}'::jsonb,'{"protected":1}'::jsonb,'{"plan":1}'::jsonb,'ФОС источника','{}'::jsonb),
          ($4,$5,$6,'Синтетическая цель','Старая цель','{"__attestation__":{"theme":"Аттестация","control":36}}'::jsonb,'{"protected":2}'::jsonb,'{"plan":2}'::jsonb,'ФОС цели','{}'::jsonb)`,
    [ids.source, randomBytes(6).toString("hex"), ids.sourceComplect, ids.target, randomBytes(6).toString("hex"), ids.targetComplect]);
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'in_progress')",
    [ids.targetAssignment, ids.teacher, ids.target]);
  await pool.query("INSERT INTO user_complect(id,user_id,complect_id) VALUES($1,$2,$3)", [ids.owner, ids.rop, ids.targetComplect]);
  const imports = new TemplateImport(pool);
  const teacher = { id: ids.teacher, role: USER_ROLES.TEACHER, userName: `wt-${nonce}` };
  const rop = { id: ids.rop, role: USER_ROLES.ROP, userName: `wr-${nonce}` };
  const fieldScope = { scope: "field" };
  assert.deepEqual((await imports.sources(teacher, ids.target, undefined, undefined, fieldScope)).complects, []);
  await assert.rejects(imports.preview(teacher, [ids.source], "goals", ids.target), { status: 403 });
  await assert.rejects(imports.copy(teacher, ids.source, ids.target, { field: "goals", baseAt: null }), { status: 403 });
  assert.deepEqual((await imports.sources(rop, ids.target, undefined, true, fieldScope)).complects, []);
  assert.ok((await imports.sources(rop, ids.target, undefined)).complects.some((item) => item.id === ids.sourceComplect));
  await assert.rejects(imports.preview(rop, [ids.source], "goals", ids.target, true), { status: 403 });
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'done')", [ids.sourceAssignment, ids.teacher, ids.source]);
  assert.deepEqual((await imports.sources(teacher, ids.target, undefined, undefined, fieldScope)).complects.map((item) => item.id), [ids.sourceComplect]);
  assert.equal((await imports.preview(teacher, [ids.source], "goals", ids.target))[0].goals, "Цель источника");
  await pool.query("DELETE FROM teacher_templates WHERE id=$1", [ids.sourceAssignment]);
  await assert.rejects(imports.copy(teacher, ids.source, ids.target, { field: "goals", baseAt: null }), { status: 403 });
  const before = (await pool.query("SELECT goals,competencies,study_load,assessment_tools_template,disciplins_name,content,textbook FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0];
  const revision = (await imports.wordSnapshot(teacher, ids.target)).targetRevision;
  const applied = await imports.wordApply(teacher, ids.target, { expectedRevision: revision, mode: "replace",
    selectedFields: ["goals", "content", "textbook"], values: { goals: "Текст <script>alert(1)</script>", textbook: ["Учебник"],
      content: { "1": { theme: "Тема <img>", total: 8, lectures: 2, seminars: 2, contact: 4, independent_work: 4, control: null } } } });
  assert.deepEqual(applied.updatedFields, ["goals", "content", "textbook"]);
  const after = (await pool.query("SELECT goals,competencies,study_load,assessment_tools_template,disciplins_name,content,textbook FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0];
  assert.match(after.goals, /&lt;script&gt;/);
  assert.equal(after.content["1"].theme, "Тема &lt;img&gt;");
  assert.deepEqual(after.textbook, ["Учебник"]);
  assert.deepEqual(after.content.__attestation__, before.content.__attestation__);
  for (const field of ["competencies", "study_load", "assessment_tools_template", "disciplins_name"])
    assert.deepEqual(after[field], before[field], field);
  const appended = await imports.wordApply(teacher, ids.target, { expectedRevision: applied.targetRevision, mode: "append",
    selectedFields: ["goals", "content", "textbook"], values: { goals: "Добавлено", textbook: ["Второй учебник"],
      content: { "1": { theme: "Вторая тема", total: 4, lectures: 2, seminars: 0, contact: 2, independent_work: 2, control: null } } } });
  const afterAppend = (await pool.query("SELECT goals,content,textbook FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0];
  assert.match(afterAppend.goals, /<br\/><br\/>Добавлено$/);
  assert.equal(afterAppend.content["2"].theme, "Вторая тема");
  assert.deepEqual(afterAppend.textbook, ["Учебник", "Второй учебник"]);
  assert.deepEqual(afterAppend.content.__attestation__, before.content.__attestation__);
  await assert.rejects(imports.wordApply(teacher, ids.target, { expectedRevision: revision, mode: "replace",
    selectedFields: ["goals"], values: { goals: "Повтор" } }), { status: 409 });
  await pool.query("DELETE FROM teacher_templates WHERE id=$1", [ids.targetAssignment]);
  await assert.rejects(imports.wordApply(teacher, ids.target, { expectedRevision: appended.targetRevision, mode: "append",
    selectedFields: ["goals"], values: { goals: "Без доступа" } }), { status: 403 });
});
