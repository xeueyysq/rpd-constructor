import test from "node:test";
import assert from "node:assert/strict";
import TemplateContentControl from "../app/services/TemplateContentControl.ts";
import { admin, rop, teacher, templateDatabase } from "./helpers/templateImportDatabase.ts";

test("ROP очищает только контроль выбранной обычной темы, сохраняет всё остальное и получает value/edit", async () => {
  const db = templateDatabase();
  db.state.profiles[1].content = { first: { theme: "Тема", control: "2,5", lectures: 8, seminars: 4, independent_work: 16, custom: "Сохранить" }, second: { theme: "Другая тема", control: 2 }, __attestation__: { theme: "Аттестация", control: 36 } };
  const before = structuredClone(db.state.profiles[1]);
  const result = await new TemplateContentControl(db.db).clear(20, rop, "first", null);
  assert.deepEqual(result.value, { ...before.content as object, first: { ...(before.content as Record<string, object>).first, control: 0 } });
  assert.equal(result.field, "content");
  assert.equal(result.edit.userId, rop.id);
  assert.equal(db.state.profiles[1].goals, before.goals);
  assert.deepEqual(db.state.profiles[1].study_load, before.study_load);
  const after = structuredClone(db.state);
  await assert.rejects(new TemplateContentControl(db.db).clear(20, rop, "second", null), { status: 409 });
  assert.deepEqual(db.state, after);
  await assert.rejects(new TemplateContentControl(db.db).clear(20, rop, "first", result.edit.at), { status: 422 });
});

test("clear: teachers403, чужой ROP403, admin может; закрытая цель409", async () => {
  const db = templateDatabase();
  const control = new TemplateContentControl(db.db);
  const before = structuredClone(db.state);
  await assert.rejects(control.clear(20, teacher, "first", null), { status: 403 });
  await assert.rejects(control.clear(10, rop, "first", null), { status: 403 });
  assert.deepEqual(db.state, before);
  await control.clear(10, admin, "first", null);
  db.state.statuses[1].current_status = "ready";
  await assert.rejects(control.clear(20, rop, "first", null), { status: 409 });
});

test("clear отвергает аттестацию, отсутствующую/пустую тему, нулевой и нечисловой контроль и отсутствующий baseline", async () => {
  const db = templateDatabase();
  db.state.profiles[1].content = { first: { theme: "Тема", control: 0 }, invalid: { theme: "Тема", control: "сломано" }, blank: { control: 3 }, __attestation__: { theme: "Аттестация", control: 36 } };
  const before = structuredClone(db.state);
  const control = new TemplateContentControl(db.db);
  for (const rowId of ["__attestation__", "missing", "first", "invalid", "blank", "__proto__"]) await assert.rejects(control.clear(20, rop, rowId, null), { status: 422 });
  await assert.rejects(control.clear(20, rop, "first", undefined), { status: 422 });
  assert.deepEqual(db.state, before);
});
