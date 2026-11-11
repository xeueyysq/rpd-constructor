import test from "node:test";
import assert from "node:assert/strict";
import { issueTeacherImportManifest, verifyTeacherImportManifest } from "../app/modules/teacherImportManifest.ts";
import { Unprocessable } from "../app/utils/Errors.ts";
import { teacherPerson } from "../app/modules/teacherNames.ts";
import TokenService from "../app/services/Token.ts";

test("полные имена карточек не достраиваются из инициалов, вакансий или произвольных пометок", () => {
  assert.deepEqual(teacherPerson(" Ёлкин  Семён (внеш.совм.) "), {
    key: "елкин семен", label: "Ёлкин Семён", fullname: { surname: "Ёлкин", name: "Семён", patronymic: "" },
  });
  for (const value of ["", "Вакансия кафедра тестов", "Нет данных", "Не назначен", "Тестов С.П.", "Тестов С П", "Тестов", "Тестов Семён (другое)", "Тестов Семён Тестович лишнее"]) {
    assert.equal(teacherPerson(value), null);
  }
});

test("манифест проверяет целостность, срок, пользователя и комплект; не является auth JWT", async (t) => {
  const previous = process.env.ACCESS_TOKEN_SECRET;
  process.env.ACCESS_TOKEN_SECRET = "synthetic-manifest-test-secret";
  t.after(() => { if (previous === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = previous; });
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-01T00:00:00Z") });
  const actor = { id: 7, role: 3, userName: "synthetic" };
  const names = ["Тестов Семён", "Другов Синтетик Проверкович"];
  const manifest = issueTeacherImportManifest([...names, names[0]], 8, actor);
  await assert.rejects(TokenService.verifyAccessToken(manifest));
  assert.deepEqual(verifyTeacherImportManifest(manifest, 8, actor), names);
  for (const invalid of [undefined, null, "", {}, `${manifest}.extra`, `e${manifest}`, manifest.slice(0, -2)]) {
    assert.throws(() => verifyTeacherImportManifest(invalid, 8, actor), Unprocessable);
  }
  assert.throws(() => verifyTeacherImportManifest(manifest, 9, actor), Unprocessable);
  assert.throws(() => verifyTeacherImportManifest(manifest, 8, { ...actor, id: 9 }), Unprocessable);
  t.mock.timers.tick(15 * 60 * 1000);
  assert.throws(() => verifyTeacherImportManifest(manifest, 8, actor), Unprocessable);
});
