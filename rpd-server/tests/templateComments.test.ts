import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";
import RpdProfileTemplatesController from "../app/controllers/rpdProfileTemplatesController.ts";

const comment = {
  id: 3, id_profile_template: 12, template_field: "goals",
  comment_text: "<p>Комментарий</p>", commentator_id: 7,
  commentator_fullname: "Иванов Иван Иванович",
  created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z",
};

test("сохранение комментария возвращает ФИО и сохраняет прежние поля ответа", async () => {
  const db = { query: async (sql: string, values?: unknown[]) => {
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: 12 }] };
    assert.match(sql, /ON CONFLICT \(id_profile_template, template_field\)/);
    assert.match(sql, /commentator_id = EXCLUDED.commentator_id/);
    assert.match(sql, /SELECT saved\.\*,[\s\S]*AS commentator_fullname/);
    assert.match(sql, /LEFT JOIN users u ON u.id = saved.commentator_id/);
    assert.deepEqual(values, [12, 7, "goals", comment.comment_text]);
    return { rows: [comment] };
  } } as unknown as Pool;
  assert.deepEqual(await new RpdProfileTemplates(db).upsetTemplateComment(12, 7, "goals", comment.comment_text), comment);
});

test("загрузка комментариев дополняет JSON именем через LEFT JOIN, с запасными логином и прочерком", async () => {
  const db = { query: async (sql: string) => {
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: 12 }] };
    if (sql.includes("FROM rpd_profile_templates rpt")) {
      assert.match(sql, /LEFT JOIN users u ON u.id = tfc.commentator_id/);
      assert.match(sql, /jsonb_build_object\('commentator_fullname', COALESCE/);
      assert.match(sql, /u\.fullname ->> 'surname'/);
      assert.match(sql, /u\.fullname ->> 'name'/);
      assert.match(sql, /u\.fullname ->> 'patronymic'/);
      assert.match(sql, /u\.name, '—'/);
      return { rows: [{ id: 12, field_edits: {}, comments: { goals: comment } }] };
    }
    return { rows: [] };
  } } as unknown as Pool;
  assert.deepEqual((await new RpdProfileTemplates(db).getJsonProfile(12))?.comments, { goals: comment });
});

test("автор комментария берётся из сессии и ФИО доходит до HTTP ответа", async () => {
  const db = { query: async (sql: string, values?: unknown[]) => {
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: 12 }] };
    assert.equal(values?.[1], 7);
    return { rows: [comment] };
  } } as unknown as Pool;
  let sent: unknown;
  const request = {
    params: { id: "12" }, user: { id: 7 },
    body: { field: "goals", value: comment.comment_text, commentator_id: 99 },
  } as unknown as Request;
  const response = { json: (value: unknown) => { sent = value; } } as unknown as Response;
  await new RpdProfileTemplatesController(db).upsetTemplateComment(request, response);
  assert.deepEqual(sent, comment);
});

test("неизвестный шаблон не создаёт комментарий", async () => {
  let queries = 0;
  const db = { query: async () => { queries += 1; return { rows: [] }; } } as unknown as Pool;
  assert.equal(await new RpdProfileTemplates(db).upsetTemplateComment(999, 7, "goals", "Текст"), null);
  assert.equal(queries, 1);
});
