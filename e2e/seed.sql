-- Все данные синтетические. Пароль каждого пользователя: e2e-password.
UPDATE users SET password = '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza',
  fullname = '{"surname":"Руководов","name":"Тест","patronymic":"Тестович"}'::jsonb WHERE name = 'rop';
UPDATE users SET password = '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza',
  fullname = '{"surname":"Альфина","name":"Тест","patronymic":"Тестовна"}'::jsonb WHERE name = 'teacher';
UPDATE users SET password = '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza',
  fullname = '{"surname":"Админов","name":"Тест","patronymic":"Тестович"}'::jsonb WHERE name = 'admin';
INSERT INTO users (id, name, password, role, fullname) VALUES
  (10, 'teacher2', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, '{"surname":"Яковлева","name":"Тест","patronymic":"Тестовна"}'),
  (11, 'nofio', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, NULL),
  (12, 'retired', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, '{"surname":"Уходов","name":"Тест","patronymic":"Тестович"}'),
  (13, 'rop2', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 3, '{"surname":"Другов","name":"Тест","patronymic":"Тестович"}'),
  (14, 'teacher3', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, '{"surname":"Третьева","name":"Тест","patronymic":"Тестовна"}'),
  (15, 'teacher4', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, '{"surname":"Отключева","name":"Тест","patronymic":"Тестовна"}'),
  (20, 'sync-teacher', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, '{"surname":"Синхронова","name":"Тест","patronymic":"Тестовна"}');
-- Отдельный владелец жизненного цикла каталога: другие сценарии не меняют его комплекты.
INSERT INTO users (id, name, password, role, fullname)
SELECT 30, 'field-reopen-rop', password, 3,
  '{"surname":"Каталогов","name":"Тест","patronymic":"Тестович"}'::jsonb
FROM users WHERE name = 'rop';
-- Владельцы изолированных сценариев sync; не пересекаются с каталогом packet1.
INSERT INTO users (id, name, password, role, fullname)
SELECT fixture.id, fixture.name, rop.password, 3,
  '{"surname":"Синхронов","name":"Тест","patronymic":"Тестович"}'::jsonb
FROM users rop CROSS JOIN (VALUES
  (32, 'sync-owner-rop'), (33, 'sync-other-rop'), (34, 'sync-dialog-rop')
) fixture(id, name) WHERE rop.name = 'rop';
-- Независимые РОП для множественного назначения и проверки неактивного адресата.
INSERT INTO users (id, name, password, role, fullname, is_active)
SELECT fixture.id, fixture.name, rop.password, 3,
  jsonb_build_object('surname', fixture.surname, 'name', 'Тест', 'patronymic', 'Тестович'), fixture.active
FROM users rop CROSS JOIN (VALUES
  (35, 'owner-third-rop', 'Троев', true), (36, 'owner-inactive-rop', 'Неактивов', false)
) fixture(id, name, surname, active) WHERE rop.name = 'rop';
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users));

INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction, has_pending_changes, last_synced_at) VALUES
  (100, '11111111-1111-4111-8111-111111111111', 'Тестовый институт', 2025, 'Очная', 'Бакалавриат', 'Синтетический профиль', 'Тестовое направление', true, '2025-02-02T00:00:00Z'),
  (101, '22222222-2222-4222-8222-222222222222', 'Другой тестовый институт', 2026, 'Очная', 'Бакалавриат', 'Другой синтетический профиль', 'Другое направление', false, NULL),
  -- Смена владельца этого комплекта не меняет доступ к шаблонам параллельных тестов.
  (102, '33333333-3333-4333-8333-333333333333', 'Тестовый институт', 2025, 'Очная', 'Бакалавриат', 'Профиль смены владельца', 'Тестовое направление', false, NULL);
INSERT INTO user_complect (id, user_id, complect_id) VALUES
  (100, (SELECT id FROM users WHERE name = 'rop'), 100),
  (101, 13, 101),
  (102, (SELECT id FROM users WHERE name = 'rop'), 102);

-- Owner acceptance: production exchange1C связывает новый комплект с создателем-admin.
-- Второй комплект дополнительно хранит неактивного РОП, прежнего РОП с ролью teacher и действующего РОП.
INSERT INTO rpd_complects (id, faculty, year, education_form, education_level, profile, direction) VALUES
  (360, 'Институт назначения РОП', 2026, 'Очная', 'Бакалавриат', 'Первое назначение РОП после создания', 'Синтетическое направление'),
  (361, 'Институт назначения РОП', 2026, 'Очная', 'Бакалавриат', 'Прежние недопустимые владельцы', 'Синтетическое направление');
INSERT INTO user_complect (user_id, complect_id)
SELECT id, 360 FROM users WHERE name = 'admin';
INSERT INTO user_complect (user_id, complect_id)
SELECT id, 361 FROM users WHERE name = 'admin' OR id IN (10, 13, 36);

-- Изолированный комплект: регрессия титула, компетенций и повторного импорта создаёт строки через API.
INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction) VALUES
  (90, '90909090-9090-4090-8090-909090909090', 'Тестовый институт', 2026, 'Очная', 'Бакалавриат', 'Регрессия титула и компетенций', 'Тестовое направление');
INSERT INTO user_complect (id, user_id, complect_id) VALUES (90, (SELECT id FROM users WHERE name = 'rop'), 90);

INSERT INTO rpd_1c_exchange (id, id_rpd_complect, department, discipline, teachers, zet, place, record_type, study_load, control_load, semester) VALUES
  (100, 100, 'Тестовая кафедра', 'Алгоритмы для теста', ARRAY['Альфина Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (101, 100, 'Тестовая кафедра', 'Базы данных для теста', ARRAY['Альфина Тест Тестовна'], 4, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 2),
  (102, 100, 'Тестовая кафедра', 'Сети для теста', ARRAY['Яковлева Тест Тестовна'], 2, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 3),
  (103, 100, 'Тестовая кафедра', 'Часы для теста', ARRAY['Яковлева Тест Тестовна'], 4, 'Базовая часть', 'discipline', '{"Всего":"144","Лекции":"34","Практика":"26","Лабораторные":"8","Контроль":"45","СРС":"31","КРП":"0"}'::jsonb, '{"Экзамен":"да"}'::jsonb, 4),
  (105, 100, 'Тестовая кафедра', 'Совместная работа для теста', ARRAY[]::text[], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (106, 100, 'Тестовая кафедра', 'Деактивация для теста', ARRAY[]::text[], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (107, 100, 'Тестовая кафедра', 'Синхронизация для теста', ARRAY['Третьева Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (108, 100, 'Тестовая кафедра', 'Лист согласования для теста', ARRAY['Альфина Тест Тестовна', 'Яковлева Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (109, 101, 'Другая кафедра', 'РПД другого РОП для теста', ARRAY[]::text[], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (110, 100, 'Тестовая кафедра', 'Совместное редактирование для теста', ARRAY['Альфина Тест Тестовна', 'Яковлева Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (111, 100, 'Тестовая кафедра', 'Конфликт правок для теста', ARRAY['Альфина Тест Тестовна', 'Яковлева Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (112, 100, 'Тестовая кафедра', 'Литература для теста', ARRAY['Альфина Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (113, 100, 'Тестовая кафедра', 'Создание без преподавателя для теста', ARRAY[]::text[], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 2);
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, competencies, content, study_load, control_load, assessment_tools_questions) VALUES
  (100, 'aaaaaaaaaaaa', 100, 'Алгоритмы для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (101, 'bbbbbbbbbbbb', 100, 'Базы данных для теста', 'Тестовая кафедра', 2, 4, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (102, 'a102a102a102', 100, 'Сети для теста', 'Тестовая кафедра', 3, 2, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (113, 'a113a113a113', 100, 'Создание без преподавателя для теста', 'Тестовая кафедра', 2, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (103, 'cccccccccccc', 100, 'Часы для теста', 'Тестовая кафедра', 4, 4, '{}'::jsonb, '{"0":{"theme":"Тема 1","lectures":17,"seminars":17,"control":0,"independent_work":15},"1":{"theme":"Тема 2","lectures":17,"seminars":17,"control":0,"independent_work":16},"__attestation__":{"theme":"Промежуточная аттестация: экзамен","lectures":0,"seminars":0,"control":45,"independent_work":0}}'::jsonb, '{"Всего":"144","Лекции":"34","Практика":"26","Лабораторные":"8","Контроль":"45","СРС":"31","КРП":"0"}'::jsonb, '{"Экзамен":"да"}'::jsonb, '{}'::jsonb),
  (105, 'eeeeeeeeeeee', 100, 'Совместная работа для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (106, 'ffffffffffff', 100, 'Деактивация для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (107, 'a107a107a107', 100, 'Синхронизация для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (108, 'a108a108a108', 100, 'Лист согласования для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (109, 'a109a109a109', 101, 'РПД другого РОП для теста', 'Другая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, goals, field_edits) VALUES
  (110, 'a110a110a110', 100, 'Совместное редактирование для теста', 'Тестовая кафедра', 1, 3, '<p>Исходные цели совместной работы</p>', '{}'::jsonb),
  (111, 'a111a111a111', 100, 'Конфликт правок для теста', 'Тестовая кафедра', 1, 3, '<p>Исходные цели для проверки конфликта</p>', '{}'::jsonb);
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, additional_textbook) VALUES
  (112, 'a112a112a112', 100, 'Литература для теста', 'Тестовая кафедра', 1, 3, ARRAY['Дублирующая запись для теста', 'Дублирующая запись для теста']);
UPDATE rpd_profile_templates SET assessment_tools_questions = '{"competencies":{"ТЕСТ-1 Анализировать учебные данные":{"openPool":[{"id":"open-1","text":"Как проверить источник?","correctAnswer":"Сверить данные"},{"id":"open-2","text":"Как сохранить данные?","correctAnswer":"Создать копию"}],"closedPool":[{"id":"closed-1","text":"Есть ли ошибка?","correctAnswer":"Да"},{"id":"closed-2","text":"Есть ли копия?","correctAnswer":"Нет"}],"selectedOpenIds":["open-1"],"selectedClosedIds":["closed-1"]}}}'::jsonb WHERE id = 112;
UPDATE rpd_profile_templates SET certification = 'Экзамен' WHERE id = 103;
-- Копия для API-проверок: teacher2 может менять content, UI-тесты не трогают её.
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, certification, competencies, content, study_load, control_load, assessment_tools_questions)
  SELECT 104, 'dddddddddddd', id_rpd_complect, 'Часы API для теста', department, semester, zet, certification, competencies, content, study_load, control_load, assessment_tools_questions
  FROM rpd_profile_templates WHERE id = 103;
INSERT INTO teacher_templates (id, user_id, template_id, state) VALUES
  (100, (SELECT id FROM users WHERE name = 'teacher'), 100, 'in_progress'),
  (101, (SELECT id FROM users WHERE name = 'teacher'), 101, 'done'),
  (102, 12, 100, 'assigned'),
  (103, 10, 103, 'in_progress'),
  (104, 10, 104, 'in_progress'),
  (105, 10, 106, 'assigned'),
  (106, 15, 106, 'assigned'),
  (107, 14, 107, 'in_progress'),
  (108, (SELECT id FROM users WHERE name = 'teacher'), 108, 'in_progress'),
  (109, 10, 108, 'assigned'),
  (110, (SELECT id FROM users WHERE name = 'teacher'), 110, 'assigned'),
  (111, 10, 110, 'assigned'),
  (112, (SELECT id FROM users WHERE name = 'teacher'), 111, 'assigned'),
  (113, 10, 111, 'assigned'),
  (114, (SELECT id FROM users WHERE name = 'teacher'), 112, 'assigned');
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history) VALUES
  (100, 100, 100, 'in_progress', '[{"date":"2025-01-01T00:00:00.000Z","status":"in_progress","user":"teacher"}]'::jsonb),
  (101, 101, 101, 'ready', '[{"date":"2025-01-02T00:00:00.000Z","status":"ready","user":"teacher"}]'::jsonb),
  (102, 102, 102, 'created', '[{"date":"2025-01-03T00:00:00.000Z","status":"created","user":"rop"}]'::jsonb),
  (103, 103, 103, 'in_progress', '[{"date":"2025-01-04T00:00:00.000Z","status":"in_progress","user":"teacher2"}]'::jsonb),
  (104, NULL, 104, 'in_progress', '[{"date":"2025-01-04T00:00:00.000Z","status":"in_progress","user":"teacher2"}]'::jsonb),
  (105, 105, 105, 'created', '[{"date":"2025-01-05T00:00:00.000Z","status":"created","user":"rop"}]'::jsonb),
  (106, 106, 106, 'on_teacher', '[{"date":"2025-01-06T00:00:00.000Z","status":"on_teacher","user":"rop"}]'::jsonb),
  (107, 107, 107, 'in_progress', '[{"date":"2025-01-07T00:00:00.000Z","status":"in_progress","user":"teacher3"}]'::jsonb),
  (108, 108, 108, 'in_progress', '[{"date":"2025-01-08T00:00:00.000Z","status":"in_progress","user":"teacher"}]'::jsonb),
  (109, 109, 109, 'created', '[{"date":"2025-01-09T00:00:00.000Z","status":"created","user":"rop2"}]'::jsonb),
  (110, 110, 110, 'on_teacher', '[{"date":"2025-01-10T00:00:00.000Z","status":"on_teacher","user":"rop"}]'::jsonb),
  (111, 111, 111, 'on_teacher', '[{"date":"2025-01-11T00:00:00.000Z","status":"on_teacher","user":"rop"}]'::jsonb),
  (112, 112, 112, 'on_teacher', '[{"date":"2025-01-12T00:00:00.000Z","status":"on_teacher","user":"rop"}]'::jsonb),
  (113, 113, 113, 'created', '[{"date":"2025-01-13T00:00:00.000Z","status":"created","user":"rop"}]'::jsonb);

INSERT INTO complect_sync_log (id, complect_id, user_id, source, created_at) VALUES
  (100, 100, (SELECT id FROM users WHERE name = 'rop'), '1c', '2025-02-01T00:00:00Z'),
  (101, 100, (SELECT id FROM users WHERE name = 'rop'), '1c', '2025-02-02T00:00:00Z');
-- Старое создание подтверждено; последняя группа содержит и подтверждённое поле, и преподавателей.
INSERT INTO template_field_changes (id, sync_log_id, id_1c_exchange, id_profile_template, field_key, old_value, new_value, applied_at, acknowledged_at) VALUES
  (100, 100, 107, 107, 'zet', '2'::jsonb, '3'::jsonb, '2025-02-01T00:00:00Z', '2025-02-01T01:00:00Z'),
  (101, 100, 107, 107, '__new__', NULL, '{"discipline":"Синхронизация для теста"}'::jsonb, '2025-02-01T00:00:00Z', '2025-02-01T01:00:00Z'),
  (102, 101, 107, 107, 'zet', '3'::jsonb, '4'::jsonb, '2025-02-02T00:00:00Z', '2025-02-02T01:00:00Z'),
  (103, 101, 107, NULL, 'teachers', '[]'::jsonb, '["Третьева Тест Тестовна"]'::jsonb, '2025-02-02T00:00:00Z', NULL);

INSERT INTO planned_results_sets (id, complect_id) VALUES (100, 100);
INSERT INTO planned_competencies (id, set_id, competence) VALUES (100, 100, 'ТЕСТ-1 Анализировать учебные данные');
INSERT INTO planned_indicators (id, competence_id, indicator) VALUES (100, 100, 'ТЕСТ-1.1 Проверяет данные');
INSERT INTO planned_indicator_disciplines (id, indicator_id, discipline) VALUES (100, 100, 'Алгоритмы для теста');

-- Отдельные комплекты для проверки реальной записи часов: параллельные UI-тесты их не меняют.
INSERT INTO rpd_complects (id, faculty, year, education_form, education_level, profile, direction) VALUES
  (200, 'Тестовый институт', 2026, 'Очная', 'Бакалавриат', 'Проверка записи часов', 'Тестовое направление'),
  (201, 'Тестовый институт', 2026, 'Очная', 'Бакалавриат', 'Защита чужих часов', 'Тестовое направление');
INSERT INTO user_complect (id, user_id, complect_id) VALUES
  (200, (SELECT id FROM users WHERE name = 'rop'), 200), (201, 13, 201);
INSERT INTO rpd_1c_exchange (id, id_rpd_complect, department, discipline, teachers, zet, place, record_type, study_load, control_load, semester) VALUES
  (200, 200, 'Кафедра синхронизации', 'Восстановление часов', ARRAY[]::text[], 4, 'Базовая часть', 'discipline', '{"Лекции":34,"Практические":34,"СРС":40}'::jsonb, '{"Экзамен":36}'::jsonb, 1),
  (201, 200, 'Кафедра синхронизации', 'Соседняя РПД', ARRAY[]::text[], 2, 'Базовая часть', 'discipline', '{"Всего":72}'::jsonb, '{}'::jsonb, 1),
  (202, 201, 'Другая кафедра', 'Чужая РПД', ARRAY[]::text[], 5, 'Базовая часть', 'discipline', '{"Всего":180}'::jsonb, '{}'::jsonb, 1);
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, certification, content, study_load, control_load) VALUES
  (200, 'a200a200a200', 200, 'Восстановление часов', 'Кафедра синхронизации', 1, 3, 'Экзамен', '{"0":{"theme":"Сохранённая тема","lectures":10,"seminars":12,"independent_work":20}}'::jsonb, '[{"name":"Всего","id":"144"}]'::jsonb, '{"Экзамен":36}'::jsonb),
  (201, 'a201a201a201', 200, 'Соседняя РПД', 'Кафедра синхронизации', 1, 2, NULL, '{"0":{"theme":"Соседняя тема","lectures":6}}'::jsonb, '{"Всего":72}'::jsonb, '{}'::jsonb),
  (202, 'a202a202a202', 201, 'Чужая РПД', 'Другая кафедра', 1, 5, NULL, '{"0":{"theme":"Чужая тема","lectures":8}}'::jsonb, '{"Всего":180}'::jsonb, '{}'::jsonb);
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history) VALUES
  (200, 200, 200, 'in_progress', '[{"date":"2025-01-01T00:00:00.000Z","status":"in_progress","user":"sync-teacher"}]'::jsonb),
  (201, 201, 201, 'created', '[]'::jsonb), (202, 202, 202, 'created', '[]'::jsonb);
INSERT INTO teacher_templates (id, user_id, template_id, state) VALUES (200, 20, 200, 'in_progress');

-- List3: источники неизменяемы; 300/302/303/304 назначены преподавателю для импорта,
-- 301 остаётся источником другого преподавателя для проверки ограничения доступа.
-- Два года одного профиля также проверяют повторение профиля в каждой строке списка.
-- 303/304 — другие годы программ 310/311 с прежними целями и книгами источника 302.
INSERT INTO rpd_complects (id, faculty, year, education_form, education_level, profile, direction) VALUES
  (300, 'Институт источников List3', 2026, 'Очная', 'Бакалавриат', 'List3 Источники', 'Другое направление List3'),
  (301, 'Институт источников List3', 2024, 'Заочная', 'Бакалавриат', 'List3 Источники', 'Направление List3'),
  (303, 'Институт цели List3', 2024, 'Очная', 'Бакалавриат', 'List3 Поле РОП', 'Направление List3'),
  (304, 'Институт цели List3', 2024, 'Очная', 'Бакалавриат', 'List3 Поле преподавателя', 'Направление List3'),
  (310, 'Институт цели List3', 2026, 'Очная', 'Бакалавриат', 'List3 Поле РОП', 'Направление List3'),
  (311, 'Институт цели List3', 2026, 'Очная', 'Бакалавриат', 'List3 Поле преподавателя', 'Направление List3'),
  (312, 'Институт цели List3', 2026, 'Очная', 'Бакалавриат', 'List3 Полный импорт', 'Направление List3'),
  (313, 'Институт цели List3', 2026, 'Очная', 'Бакалавриат', 'List3 Массовый импорт', 'Направление List3'),
  (316, 'Институт цели List3', 2026, 'Очная', 'Бакалавриат', 'List3 Контроль', 'Направление List3'),
  (317, 'Институт цели List3', 2026, 'Очная', 'Бакалавриат', 'List3 ФОС', 'Направление List3');
INSERT INTO user_complect (user_id, complect_id)
  SELECT (SELECT id FROM users WHERE name = CASE WHEN fixture.id < 310 THEN 'rop2' ELSE 'rop' END), fixture.id
  FROM rpd_complects fixture WHERE fixture.id IN (300, 301, 303, 304, 310, 311, 312, 313, 316, 317);

INSERT INTO rpd_profile_templates
  (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, place, certification,
   goals, content, study_load, control_load, competencies, assessment_tools_questions, assessment_tools_template,
   textbook, additional_textbook)
SELECT id, public_id, complect_id, discipline,
  CASE WHEN id < 310 THEN 'Кафедра источника List3' ELSE 'Кафедра List3' END, semester,
  CASE WHEN id < 310 THEN 5 ELSE 3 END,
  CASE WHEN id < 310 THEN 'Вариативная часть' ELSE 'Базовая часть' END,
  CASE WHEN id < 310 THEN 'Зачёт' ELSE 'Экзамен' END,
  CASE WHEN id < 310 THEN '<p>Цели источника ' || CASE WHEN id IN (303,304) THEN 302 ELSE id END || '</p>' ELSE '<p>Прежние цели цели</p>' END,
  CASE WHEN id < 310 THEN '{"0":{"theme":"Тема источника","lectures":9,"seminars":7,"independent_work":8,"control":0}}'::jsonb
    ELSE '{"0":{"theme":"Legacy тема","lectures":4,"seminars":6,"independent_work":8,"control":2},"__attestation__":{"theme":"Промежуточная аттестация: экзамен","lectures":0,"seminars":0,"independent_work":0,"control":36}}'::jsonb END,
  CASE WHEN id < 310 THEN '{"Всего":90,"Лекции":9,"Практические":7,"СРС":8,"Контроль":66}'::jsonb
    ELSE '{"Всего":54,"Лекции":4,"Практические":6,"СРС":8,"Контроль":36}'::jsonb END,
  CASE WHEN id < 310 THEN '{"Зачёт":66}'::jsonb ELSE '{"Экзамен":36}'::jsonb END,
  jsonb_build_object('0', jsonb_build_object('competence', 'ПК-L3 Авторская компетенция', 'indicator', 'ПК-L3.1 Индикатор',
    'results', jsonb_build_object('know', CASE WHEN id < 310 THEN 'Источник' ELSE 'Авторский результат цели' END, 'beAble', '', 'own', ''))),
  jsonb_build_object('controlQuestions', CASE WHEN id < 310 THEN 'ФОС источника' ELSE 'Общий вопрос цели' END,
    'competencies', jsonb_build_object('ПК-L3 Авторская компетенция', jsonb_build_object(
      'openQuestions', '', 'closedQuestions', '', 'selectedOpenIds', '[]'::jsonb, 'selectedClosedIds', '[]'::jsonb,
      'openPool', jsonb_build_array(jsonb_build_object('id', 'list3-open', 'text', 'Открытый вопрос цели', 'correctAnswer', 'Открытый ответ цели')),
      'closedPool', jsonb_build_array(jsonb_build_object('id', 'list3-closed', 'text', 'Закрытый вопрос цели', 'correctAnswer', 'Закрытый ответ цели'))))),
  CASE WHEN id < 310 THEN '<p>Шаблон ФОС источника</p>' ELSE '<p>Шаблон ФОС цели</p>' END,
  ARRAY['Основная книга ' || CASE WHEN id IN (303,304) THEN 302 ELSE id END,
    'Вторая основная книга ' || CASE WHEN id IN (303,304) THEN 302 ELSE id END],
  ARRAY['Дополнительная книга ' || CASE WHEN id IN (303,304) THEN 302 ELSE id END]
FROM (VALUES
  (300, 'a300a300a300', 300, '  ИМПОРТ   ПОЛЯ LIST3  ', 1),
  (301, 'a301a301a301', 300, 'Импорт поля List3', 2),
  (302, 'a302a302a302', 301, '  ИМПОРТ   ПОЛЯ LIST3  ', 1),
  (303, 'a303a303a303', 303, '  ИМПОРТ   ПОЛЯ LIST3  ', 1),
  (304, 'a304a304a304', 304, '  ИМПОРТ   ПОЛЯ LIST3  ', 1),
  (310, 'a310a310a310', 310, 'Импорт поля List3', 1),
  (311, 'a311a311a311', 311, 'Импорт поля List3', 1),
  (312, 'a312a312a312', 312, 'Импорт поля List3', 4),
  (313, 'a313a313a313', 313, 'Импорт поля List3', 1),
  (314, 'a314a314a314', 313, 'Импорт поля List3', 3),
  (315, 'a315a315a315', 313, 'Импорт поля List3', 2),
  (316, 'a316a316a316', 316, 'Legacy контроль List3', 1),
  (317, 'a317a317a317', 317, 'Сохранение ФОС List3', 1),
  (318, 'a318a318a318', 101, 'Режим РОП-преподавателя List3', 1)
) AS fixture(id, public_id, complect_id, discipline, semester);
INSERT INTO rpd_1c_exchange
  (id, id_rpd_complect, department, discipline, teachers, zet, place, record_type, study_load, control_load, semester)
SELECT id, id_rpd_complect, department, disciplins_name, ARRAY[]::text[], zet, place,
  CASE WHEN id = 315 THEN 'practice' ELSE 'discipline' END, study_load, control_load, semester
FROM rpd_profile_templates WHERE id BETWEEN 300 AND 318;
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history)
SELECT id, id, id, CASE WHEN id IN (301, 311, 316, 317) THEN 'on_teacher' ELSE 'created' END, '[]'::jsonb
FROM rpd_profile_templates WHERE id BETWEEN 300 AND 318;
INSERT INTO teacher_templates (user_id, template_id, state)
SELECT (SELECT id FROM users WHERE name = CASE WHEN fixture.id = 301 THEN 'teacher2' ELSE 'teacher' END), fixture.id, 'assigned'
FROM rpd_profile_templates fixture WHERE fixture.id IN (300, 301, 302, 303, 304, 311, 316, 317);
INSERT INTO planned_results_sets (id, complect_id) VALUES (317, 317);
INSERT INTO planned_competencies (id, set_id, competence) VALUES (317, 317, 'ПК-L3 Авторская компетенция');
INSERT INTO planned_indicators (id, competence_id, indicator) VALUES (317, 317, 'ПК-L3.1 Индикатор');
INSERT INTO planned_indicator_disciplines (id, indicator_id, discipline) VALUES (317, 317, 'Сохранение ФОС List3');

-- Источник в комплекте 321 появится через sync/add после первого открытия поля 320.
INSERT INTO rpd_complects (id, faculty, year, education_form, education_level, profile, direction) VALUES
  (320, 'Институт каталога List3', 2026, 'Очная', 'Бакалавриат', 'List3 Повторное открытие', 'Направление каталога List3'),
  (321, 'Институт каталога List3', 2024, 'Очная', 'Бакалавриат', 'List3 Повторное открытие', 'Направление каталога List3');
INSERT INTO user_complect (user_id, complect_id) VALUES (30, 320), (30, 321);
INSERT INTO rpd_profile_templates
  (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, goals, content, study_load, control_load, field_edits)
VALUES (320, 'a320a320a320', 320, 'Повторное открытие импорта List3', 'Кафедра каталога List3', 1, 3,
  '<p>Исходные цели повторного открытия</p>', '{}'::jsonb, '{"Всего":108}'::jsonb, '{}'::jsonb,
  '{"goals":{"userId":30,"at":"2026-01-01T00:00:00.000Z"}}'::jsonb);
INSERT INTO rpd_1c_exchange
  (id, id_rpd_complect, department, discipline, teachers, zet, record_type, study_load, control_load, semester)
VALUES (320, 320, 'Кафедра каталога List3', 'Повторное открытие импорта List3', ARRAY[]::text[], 3,
  'discipline', '{"Всего":108}'::jsonb, '{}'::jsonb, 1);
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history)
VALUES (320, 320, 320, 'created', '[]'::jsonb);

-- HTTP/PostgreSQL rollback, add/remove/restore и гонки диалога используют разные комплекты.
INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction) VALUES
  (330, '33000000-0000-4000-8000-000000000330', 'Институт sync', 2026, 'Очная', 'Бакалавриат', 'Sync rollback A', 'Направление sync'),
  (331, '33000000-0000-4000-8000-000000000331', 'Институт sync', 2026, 'Очная', 'Бакалавриат', 'Sync rollback B', 'Направление sync'),
  (332, '33000000-0000-4000-8000-000000000332', 'Институт sync', 2026, 'Очная', 'Бакалавриат', 'Sync lifecycle', 'Направление sync'),
  (333, '33000000-0000-4000-8000-000000000333', 'Институт sync', 2026, 'Очная', 'Бакалавриат', 'Sync dialog A', 'Направление sync'),
  (334, '33000000-0000-4000-8000-000000000334', 'Институт sync', 2026, 'Очная', 'Бакалавриат', 'Sync dialog B', 'Направление sync');
INSERT INTO user_complect (user_id, complect_id) VALUES
  (32, 330), (33, 331), (32, 332), (34, 333), (34, 334);
INSERT INTO rpd_profile_templates
  (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, goals, content, study_load, control_load)
SELECT id, public_id, id, discipline, 'Кафедра sync', 1, 3,
  '<p>Сохранённые цели ' || id || '</p>',
  '{"0":{"theme":"Сохранённая тема sync","lectures":8,"seminars":6,"independent_work":4,"control":0}}'::jsonb,
  '{"Всего":108}'::jsonb, '{}'::jsonb
FROM (VALUES (330, 'a330a330a330', 'Своя строка sync'), (331, 'a331a331a331', 'Чужая строка sync'))
  fixture(id, public_id, discipline);
INSERT INTO rpd_1c_exchange
  (id, id_rpd_complect, department, discipline, teachers, zet, record_type, study_load, control_load, semester)
SELECT id, id_rpd_complect, department, disciplins_name, ARRAY[]::text[], zet, 'discipline', study_load, control_load, semester
FROM rpd_profile_templates WHERE id IN (330, 331);
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history)
SELECT id, id, id, 'on_teacher', '[]'::jsonb FROM rpd_profile_templates WHERE id IN (330, 331);
INSERT INTO teacher_templates (user_id, template_id, state) VALUES (20, 330, 'assigned'), (20, 331, 'assigned');

-- Назначение преподавателем независимо от управления комплектом 102.
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, goals)
VALUES (350, 'a350a350a350', 102, 'Множественные РОП для теста', 'Кафедра назначения РОП', 1, 3, '<p>Сохранённое содержание владельцев</p>');
INSERT INTO template_status (id, id_profile_template, current_status, history)
VALUES (350, 350, 'on_teacher', '[]'::jsonb);
INSERT INTO teacher_templates (user_id, template_id, state) VALUES (35, 350, 'assigned');

-- Ordering acceptance: отдельный комплект, 45 строк, Е/Ё, одинаковые названия и выгруженная строка.
-- ID идут против алфавита; одинаковая «Математика» различается семестром и сортируется по exchange ID.
INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction) VALUES
  (370, '37037037-0370-4370-8370-370370370370', 'Институт порядка дисциплин', 2026, 'Очная', 'Бакалавриат', 'Алфавит и сохранение страницы', 'Синтетическое направление');
INSERT INTO user_complect (user_id, complect_id)
SELECT id, 370 FROM users WHERE name = 'rop';
INSERT INTO rpd_1c_exchange
  (id, id_rpd_complect, department, discipline, teachers, zet, record_type, study_load, control_load, semester)
SELECT fixture.id, 370, 'Кафедра порядка дисциплин', fixture.discipline, ARRAY[]::text[], 3, 'discipline', '{}'::jsonb, '{}'::jsonb, fixture.semester
FROM (VALUES
  (3744, 'Алгебра', 1),
  (3743, 'Алгоритмы', 1),
  (3742, 'Анализ данных', 1),
  (3741, 'Архитектура', 1),
  (3740, 'Базы данных', 1),
  (3739, 'Безопасность', 1),
  (3738, 'Биология', 1),
  (3737, 'Веб технологии', 1),
  (3736, 'География', 1),
  (3735, 'Геометрия', 1),
  (3734, 'Дизайн', 1),
  (3733, 'Дискретная математика', 1),
  (3732, 'Ежовые данные', 1),
  (3731, 'Ёжовые данные', 1),
  (3730, 'Жизненный цикл', 1),
  (3729, 'Защита данных', 1),
  (3728, 'Инженерия', 1),
  (3727, 'Информатика', 1),
  (3726, 'История', 1),
  (3725, 'Компьютерная графика', 1),
  (3724, 'Линейная алгебра', 1),
  (3723, 'Логика', 1),
  (3722, 'Математика', 1),
  (3721, 'Математика', 2),
  (3720, 'Машинное обучение', 1),
  (3719, 'Моделирование', 1),
  (3718, 'Операционные системы', 1),
  (3717, 'Оптимизация', 1),
  (3716, 'Программирование', 1),
  (3715, 'Проектирование', 1),
  (3714, 'Разработка', 1),
  (3713, 'Робототехника', 1),
  (3712, 'Сети', 1),
  (3711, 'Системный анализ', 1),
  (3710, 'Статистика', 1),
  (3709, 'Теория вероятностей', 1),
  (3708, 'Теория графов', 1),
  (3707, 'Тестирование', 1),
  (3706, 'Управление', 1),
  (3705, 'Физика', 1),
  (3704, 'Философия', 1),
  (3703, 'Химия', 1),
  (3702, 'Экология', 1),
  (3701, 'Экономика', 1),
  (3700, 'Языки программирования', 1)
) fixture(id, discipline, semester);
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet)
SELECT id, lpad(id::text, 12, '0'), id_rpd_complect, discipline, department, semester, zet
FROM rpd_1c_exchange WHERE id_rpd_complect = 370 AND id <> 3744;
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history)
SELECT exchange.id, exchange.id, profile.id,
  CASE exchange.id WHEN 3744 THEN 'unloaded' WHEN 3716 THEN 'on_teacher' ELSE 'created' END, '[]'::jsonb
FROM rpd_1c_exchange exchange LEFT JOIN rpd_profile_templates profile ON profile.id = exchange.id
WHERE exchange.id_rpd_complect = 370;
INSERT INTO teacher_templates (user_id, template_id, state) VALUES (10, 3716, 'assigned');

-- Изолированная цель для браузерного импорта DOCX из генератора.
INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction)
VALUES (390, '39039039-0390-4390-8390-390390390390', 'Институт Word E2E', 2026, 'Очная', 'Бакалавриат', 'Word импорт', 'Синтетическое направление');
INSERT INTO user_complect (user_id, complect_id)
SELECT id, 390 FROM users WHERE name = 'rop';
INSERT INTO rpd_profile_templates
  (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, goals, textbook, field_edits)
VALUES (390, 'a390a390a390', 390, 'Импорт Word E2E', 'Кафедра Word', 1, 3,
  '<p>Исходные цели Word</p>', ARRAY['Исходная книга Word'], '{}'::jsonb);
INSERT INTO rpd_1c_exchange
  (id, id_rpd_complect, department, discipline, teachers, zet, record_type, study_load, control_load, semester)
VALUES (390, 390, 'Кафедра Word', 'Импорт Word E2E', ARRAY[]::text[], 3, 'discipline', '{}'::jsonb, '{}'::jsonb, 1);
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history)
VALUES (390, 390, 390, 'created', '[]'::jsonb);

-- UI импорта: изолированные источники только для чтения, пагинации и полного preview.
-- 401: текущий год другого комплекта; 402: другой год точной программы 400.
INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction) VALUES
  (400, '40000000-0000-4000-8000-000000000400', 'Институт UI цели', 2026, 'Очная', 'Бакалавриат', 'UI цель', 'Направление UI'),
  (401, '40000000-0000-4000-8000-000000000401', 'Институт UI источников', 2026, 'Очная', 'Бакалавриат', 'UI источники текущего года с длинным названием профиля', 'Направление UI'),
  (402, '40000000-0000-4000-8000-000000000402', 'Институт UI цели', 2024, 'Очная', 'Бакалавриат', 'UI цель', 'Направление UI'),
  (403, '40000000-0000-4000-8000-000000000403', 'Институт UI источников', 2026, 'Очная', 'Бакалавриат', 'UI другое название', 'Направление UI'),
  (404, '40000000-0000-4000-8000-000000000404', 'Институт UI источников', 2026, 'Очная', 'Магистратура', 'UI другой уровень', 'Направление UI');
INSERT INTO user_complect (user_id, complect_id)
SELECT id, 400 FROM users WHERE name = 'rop';
INSERT INTO user_complect (user_id, complect_id) VALUES (13, 401), (35, 401);
INSERT INTO rpd_profile_templates
  (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, goals, textbook, content)
SELECT id, CASE WHEN id=4000 THEN 'd400d400d400' ELSE lpad(id::text,12,'0') END, complect_id,
  CASE WHEN id=4030 THEN 'Другая дисциплина UI' WHEN id=4020
    THEN '  ДЛИННОЕ   НАЗВАНИЕ ДИСЦИПЛИНЫ ДЛЯ ПРОВЕРКИ ИМПОРТА UI  '
    ELSE 'Длинное название дисциплины для проверки импорта UI' END,
  'Кафедра UI', CASE WHEN id BETWEEN 4010 AND 4019 THEN id-4009 WHEN id BETWEEN 4020 AND 4025 THEN id-4019 ELSE 1 END, 3,
  CASE WHEN id=4000 THEN '<p>Исходные цели UI</p>' ELSE
  '<p>Начало полного текста ' || id || '</p><p>' || repeat('Полный абзац для предпросмотра. ',40) ||
    '</p><ul><li>Первый пункт</li><li>Последний пункт</li></ul><table><tr><td>Первая ячейка</td><td>Вторая ячейка</td></tr></table>' ||
    '<script>window.__importPreviewExecuted=true</script><p>Последний абзац ' || id || '</p>' END,
  ARRAY[repeat('Полное описание книги. ',30) || 'Конец первой книги ' || id, 'Последняя книга ' || id],
  (SELECT jsonb_object_agg(n::text, jsonb_build_object('theme','Тема ' || n || ' источника ' || id,
    'lectures',n,'seminars',n+1,'contact',2*n+1,'independent_work',n+2,'control',0,'total',3*n+3))
    FROM generate_series(1,8) n)
FROM (
  SELECT 4000 AS id, 400 AS complect_id
  UNION ALL SELECT id, CASE WHEN id<4020 THEN 401 ELSE 402 END FROM generate_series(4010,4025) id
  UNION ALL SELECT 4030,403 UNION ALL SELECT 4040,404
) fixtures;
INSERT INTO rpd_1c_exchange
  (id, id_rpd_complect, department, discipline, teachers, zet, record_type, study_load, control_load, semester)
SELECT id, id_rpd_complect, department, disciplins_name, ARRAY[]::text[], zet, 'discipline', '{}'::jsonb, '{}'::jsonb, semester
FROM rpd_profile_templates WHERE id IN (4000,4030,4040) OR id BETWEEN 4010 AND 4025;
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history)
SELECT id,id,id,CASE WHEN id IN (4000,4011) THEN 'created' ELSE 'ready' END,'[]'::jsonb
FROM rpd_profile_templates WHERE id IN (4000,4030,4040) OR id BETWEEN 4010 AND 4025;
INSERT INTO teacher_templates (user_id, template_id, state)
SELECT id,fixture.template_id,'assigned' FROM users CROSS JOIN
  (VALUES (4000),(4010),(4020),(4030),(4040)) fixture(template_id) WHERE name='teacher';

SELECT setval(pg_get_serial_sequence('rpd_complects', 'id'), (SELECT max(id) FROM rpd_complects));
SELECT setval(pg_get_serial_sequence('rpd_1c_exchange', 'id'), (SELECT max(id) FROM rpd_1c_exchange));
SELECT setval(pg_get_serial_sequence('rpd_profile_templates', 'id'), (SELECT max(id) FROM rpd_profile_templates));
SELECT setval(pg_get_serial_sequence('template_status', 'id'), (SELECT max(id) FROM template_status));
SELECT setval(pg_get_serial_sequence('teacher_templates', 'id'), (SELECT max(id) FROM teacher_templates));
SELECT setval(pg_get_serial_sequence('user_complect', 'id'), (SELECT max(id) FROM user_complect));
SELECT setval(pg_get_serial_sequence('complect_sync_log', 'id'), 101);
SELECT setval(pg_get_serial_sequence('template_field_changes', 'id'), 103);
SELECT setval(pg_get_serial_sequence('planned_results_sets', 'id'), (SELECT max(id) FROM planned_results_sets));
SELECT setval(pg_get_serial_sequence('planned_competencies', 'id'), (SELECT max(id) FROM planned_competencies));
SELECT setval(pg_get_serial_sequence('planned_indicators', 'id'), (SELECT max(id) FROM planned_indicators));
SELECT setval(pg_get_serial_sequence('planned_indicator_disciplines', 'id'), (SELECT max(id) FROM planned_indicator_disciplines));
