import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express, { type ErrorRequestHandler } from "express";
import { pool } from "../../config/db.ts";
import router from "../../app/routes/routes.ts";
import TokenService from "../../app/services/Token.ts";
import { ErrorUtils } from "../../app/utils/Errors.ts";
import { USER_ROLES } from "../../app/models/constants.ts";
import type { PlannedResultEntry } from "../../app/modules/plannedResults.ts";

export async function verifyPlannedResults(t: TestContext) {
  const base = randomInt(500_000_000, 900_000_000);
  const nonce = randomBytes(6).toString("hex");
  const ids = { owner: base, foreign: base + 1, teacher: base + 2, foreignTeacher: base + 3,
    inactiveOwner: base + 4, admin: base + 5, inactiveAdmin: base + 6, inactiveTeacher: base + 7,
    a: base + 10, b: base + 11, template: base + 20 };
  const uuidA = randomUUID();
  const uuidB = randomUUID();
  t.after(async () => {
    try {
      await pool.query("DELETE FROM rpd_complects WHERE id=ANY($1::int[])", [[ids.a, ids.b]]);
      await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [[ids.owner, ids.foreign, ids.teacher, ids.foreignTeacher,
        ids.inactiveOwner, ids.admin, ids.inactiveAdmin, ids.inactiveTeacher]]);
    } finally { await pool.end(); }
  });
  const actors = [
    [ids.owner, USER_ROLES.ROP, true], [ids.foreign, USER_ROLES.ROP, true],
    [ids.teacher, USER_ROLES.TEACHER, true], [ids.foreignTeacher, USER_ROLES.TEACHER, true],
    [ids.inactiveOwner, USER_ROLES.ROP, false], [ids.admin, USER_ROLES.ADMIN, true],
    [ids.inactiveAdmin, USER_ROLES.ADMIN, false], [ids.inactiveTeacher, USER_ROLES.TEACHER, false],
  ] as const;
  const tokens = new Map<number, string>();
  for (const [id, role, active] of actors) {
    const name = `pr-${nonce}-${id - base}`;
    await pool.query("INSERT INTO users(id,name,password,role,fullname,is_active) VALUES($1,$2,'no-login',$3,'{}'::jsonb,$4)", [id, name, role, active]);
    tokens.set(id, await TokenService.generateAccessToken({ id, role, userName: name }));
  }
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$5,2096,'Очная','Бакалавриат','Матрица A','09.03.01'),
      ($3,$4,$5,2096,'Очная','Бакалавриат','Матрица B','09.03.01')`, [ids.a, uuidA, ids.b, uuidB, `Матрицы ${nonce}`]);
  await pool.query("INSERT INTO user_complect(user_id,complect_id) VALUES($1,$2),($1,$3),($4,$2)", [ids.owner, ids.a, ids.b, ids.inactiveOwner]);
  await pool.query("INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name) VALUES($1,$2,$3,'Алгоритмы')",
    [ids.template, randomBytes(6).toString("hex"), ids.a]);
  await pool.query("INSERT INTO teacher_templates(user_id,template_id,state) VALUES($1,$3,'assigned'),($2,$3,'assigned')",
    [ids.teacher, ids.inactiveTeacher, ids.template]);

  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(((error, _req, res, next) => { void next; ErrorUtils.catchError(res, error); }) as ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = async (path: string, actor: number | undefined, body?: unknown) => {
    const response = await fetch(`${url}/${path}`, { method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(actor === undefined ? {} : { Authorization: `Bearer ${tokens.get(actor)}` }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000) });
    return { status: response.status, body: await response.json() as unknown };
  };
  const upload = (complectId: number | string, data: unknown, actor: number | undefined = ids.owner) => request("set-results-data", actor, { complectId, data });
  const get = (complectId: number | string, actor: number | undefined = ids.owner) => request(`get-results-data?complectId=${complectId}`, actor);
  const snapshot = async (id: number) => {
    const queries = {
      sets: "SELECT * FROM planned_results_sets WHERE complect_id=$1 ORDER BY id",
      competencies: `SELECT c.* FROM planned_competencies c JOIN planned_results_sets s ON s.id=c.set_id WHERE s.complect_id=$1 ORDER BY c.id`,
      indicators: `SELECT i.* FROM planned_indicators i JOIN planned_competencies c ON c.id=i.competence_id
        JOIN planned_results_sets s ON s.id=c.set_id WHERE s.complect_id=$1 ORDER BY i.id`,
      disciplines: `SELECT d.* FROM planned_indicator_disciplines d JOIN planned_indicators i ON i.id=d.indicator_id
        JOIN planned_competencies c ON c.id=i.competence_id JOIN planned_results_sets s ON s.id=c.set_id WHERE s.complect_id=$1 ORDER BY d.id`,
    };
    const state: Record<string, Record<string, unknown>[]> = {};
    for (const [name, sql] of Object.entries(queries)) state[name] = (await pool.query(sql, [id])).rows;
    return state;
  };
  const matrixB: PlannedResultEntry[] = [{ competence: "ПК-B", indicator: "ПК-B.1", disciplines: ["Сети"] }];
  assert.equal((await upload(ids.b, matrixB)).status, 200);
  const beforeB = await snapshot(ids.b);
  assert.deepEqual(await get(uuidB), { status: 200, body: matrixB });
  const chosen = [
    { competence: " УК-1 ", indicator: " УК-1.1 ", disciplines: [" Алгоритмы ", "Алгоритмы", "Базы данных"] },
    { competence: "УК-1", indicator: "УК-1.1", disciplines: ["Базы данных", "Сети"] },
    { competence: "УК-1", indicator: "УК-1.2", disciplines: [] },
    { competence: "ПК-2", indicator: "—", disciplines: ["Практика"] },
  ];
  const expected: PlannedResultEntry[] = [
    { competence: "УК-1", indicator: "УК-1.1", disciplines: ["Алгоритмы", "Базы данных", "Сети"] },
    { competence: "УК-1", indicator: "УК-1.2", disciplines: [] },
    { competence: "ПК-2", indicator: "—", disciplines: ["Практика"] },
  ];
  const uploaded = await upload(uuidA, chosen);
  assert.equal(uploaded.status, 200);
  const state = await snapshot(ids.a);
  assert.deepEqual(uploaded.body, { setId: state.sets[0].id });
  assert.deepEqual(state.sets.map((s) => s.complect_id), [ids.a]);
  assert.deepEqual(state.competencies.map((c) => [c.set_id, c.competence]), [[state.sets[0].id, "УК-1"], [state.sets[0].id, "ПК-2"]]);
  assert.deepEqual(state.indicators.map((i) => [i.competence_id, i.indicator]),
    [[state.competencies[0].id, "УК-1.1"], [state.competencies[0].id, "УК-1.2"], [state.competencies[1].id, "—"]]);
  assert.deepEqual(state.disciplines.map((d) => [d.indicator_id, d.discipline]),
    [[state.indicators[0].id, "Алгоритмы"], [state.indicators[0].id, "Базы данных"], [state.indicators[0].id, "Сети"], [state.indicators[2].id, "Практика"]]);
  for (const actor of [ids.owner, ids.admin, ids.teacher]) assert.deepEqual(await get(uuidA, actor), { status: 200, body: expected });
  assert.deepEqual(await snapshot(ids.b), beforeB, "Загрузка A не меняет B того же владельца");

  const valid = { competence: "Новая компетенция", indicator: "Новый индикатор", disciplines: ["Новая дисциплина"] };
  const invalid = [null, {}, [], "file", [null], [[]], [{}], [valid, { ...valid, competence: " " }],
    [{ ...valid, indicator: "" }], [{ ...valid, disciplines: "Алгоритмы" }],
    [{ ...valid, disciplines: [" "] }], [{ ...valid, disciplines: ["Алгоритмы", 12] }]];
  for (const data of invalid) {
    assert.equal((await upload(ids.a, data)).status, 422, `Плохой payload: ${JSON.stringify(data)}`);
    assert.deepEqual(await snapshot(ids.a), state, "Невалидная строка не очищает прежние четыре таблицы");
  }
  assert.equal((await request("set-results-data", ids.owner, { complectId: ids.a })).status, 422);
  assert.equal((await request("set-results-data", undefined, { complectId: ids.a, data: [valid] })).status, 401);
  assert.equal((await request(`get-results-data?complectId=${ids.a}`, undefined)).status, 401);
  for (const actor of [ids.foreign, ids.foreignTeacher, ids.inactiveOwner, ids.inactiveAdmin, ids.inactiveTeacher]) {
    assert.equal((await get(ids.a, actor)).status, 403);
    assert.equal((await upload(ids.a, [valid], actor)).status, 403);
    assert.deepEqual(await snapshot(ids.a), state, "Отказ в доступе сохраняет матрицу");
  }
  assert.equal((await upload(ids.a, [valid], ids.teacher)).status, 403, "Назначенному преподавателю доступно только чтение");
  assert.equal((await get(ids.b, ids.teacher)).status, 403, "Назначение A не даёт чтение B");
  // PostgreSQL TEXT не принимает NUL: ошибка второй строки происходит после DELETE и вставки первой.
  const failed = await upload(ids.a, [valid, { competence: "Поздняя ошибка", indicator: "Ошибка SQL", disciplines: ["\u0000"] }]);
  assert.equal(failed.status, 500);
  assert.equal((failed.body as { code?: string }).code, "22021");
  assert.deepEqual(await snapshot(ids.a), state, "ROLLBACK восстанавливает точные прежние строки всех четырёх таблиц");
  assert.deepEqual(await get(ids.a), { status: 200, body: expected });
  assert.deepEqual(await snapshot(ids.b), beforeB);

  assert.equal((await upload(ids.a, [valid], ids.admin)).status, 200, "Активный admin может заменить матрицу");
  assert.deepEqual(await get(ids.a), { status: 200, body: [valid] });
  const replaced = await snapshot(ids.a);
  assert.equal(replaced.sets[0].id, state.sets[0].id);
  assert.equal(replaced.competencies.length, 1);
  assert.equal(replaced.indicators.length, 1);
  assert.equal(replaced.disciplines.length, 1);
  assert.deepEqual(await snapshot(ids.b), beforeB);
}
