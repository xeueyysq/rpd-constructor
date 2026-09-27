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
  (15, 'teacher4', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, '{"surname":"Отключева","name":"Тест","patronymic":"Тестовна"}');
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users));

INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction, has_pending_changes) VALUES
  (100, '11111111-1111-4111-8111-111111111111', 'Тестовый институт', 2025, 'Очная', 'Бакалавриат', 'Синтетический профиль', 'Тестовое направление', true),
  (101, '22222222-2222-4222-8222-222222222222', 'Другой тестовый институт', 2026, 'Очная', 'Бакалавриат', 'Другой синтетический профиль', 'Другое направление', false);
INSERT INTO user_complect (id, user_id, complect_id) VALUES
  (100, (SELECT id FROM users WHERE name = 'rop'), 100),
  (101, 13, 101);

INSERT INTO rpd_1c_exchange (id, id_rpd_complect, department, discipline, teachers, zet, place, record_type, study_load, control_load, semester) VALUES
  (100, 100, 'Тестовая кафедра', 'Алгоритмы для теста', ARRAY['Альфина Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (101, 100, 'Тестовая кафедра', 'Базы данных для теста', ARRAY['Альфина Тест Тестовна'], 4, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 2),
  (102, 100, 'Тестовая кафедра', 'Сети для теста', ARRAY['Яковлева Тест Тестовна'], 2, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 3),
  (103, 100, 'Тестовая кафедра', 'Часы для теста', ARRAY['Яковлева Тест Тестовна'], 4, 'Базовая часть', 'discipline', '{"Всего":"144","Лекции":"34","Практика":"26","Лабораторные":"8","Контроль":"45","СРС":"31","КРП":"0"}'::jsonb, '{"Экзамен":"да"}'::jsonb, 4),
  (105, 100, 'Тестовая кафедра', 'Совместная работа для теста', ARRAY[]::text[], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (106, 100, 'Тестовая кафедра', 'Деактивация для теста', ARRAY[]::text[], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (107, 100, 'Тестовая кафедра', 'Синхронизация для теста', ARRAY['Третьева Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (108, 100, 'Тестовая кафедра', 'Лист согласования для теста', ARRAY['Альфина Тест Тестовна', 'Яковлева Тест Тестовна'], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (109, 101, 'Другая кафедра', 'РПД другого РОП для теста', ARRAY[]::text[], 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1);
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, semester, zet, competencies, content, study_load, control_load, assessment_tools_questions) VALUES
  (100, 'aaaaaaaaaaaa', 100, 'Алгоритмы для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (101, 'bbbbbbbbbbbb', 100, 'Базы данных для теста', 'Тестовая кафедра', 2, 4, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (103, 'cccccccccccc', 100, 'Часы для теста', 'Тестовая кафедра', 4, 4, '{}'::jsonb, '{"0":{"theme":"Тема 1","lectures":17,"seminars":17,"control":0,"independent_work":15},"1":{"theme":"Тема 2","lectures":17,"seminars":17,"control":0,"independent_work":16},"__attestation__":{"theme":"Промежуточная аттестация: экзамен","lectures":0,"seminars":0,"control":45,"independent_work":0}}'::jsonb, '{"Всего":"144","Лекции":"34","Практика":"26","Лабораторные":"8","Контроль":"45","СРС":"31","КРП":"0"}'::jsonb, '{"Экзамен":"да"}'::jsonb, '{}'::jsonb),
  (105, 'eeeeeeeeeeee', 100, 'Совместная работа для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (106, 'ffffffffffff', 100, 'Деактивация для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (107, 'a107a107a107', 100, 'Синхронизация для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (108, 'a108a108a108', 100, 'Лист согласования для теста', 'Тестовая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (109, 'a109a109a109', 101, 'РПД другого РОП для теста', 'Другая кафедра', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
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
  (109, 10, 108, 'assigned');
INSERT INTO template_status (id, id_1c_template, id_profile_template, current_status, history) VALUES
  (100, 100, 100, 'in_progress', '[{"date":"2025-01-01T00:00:00.000Z","status":"in_progress","user":"teacher"}]'::jsonb),
  (101, 101, 101, 'ready', '[{"date":"2025-01-02T00:00:00.000Z","status":"ready","user":"teacher"}]'::jsonb),
  (102, 102, NULL, 'unloaded', '[{"date":"2025-01-03T00:00:00.000Z","status":"unloaded","user":"rop"}]'::jsonb),
  (103, 103, 103, 'in_progress', '[{"date":"2025-01-04T00:00:00.000Z","status":"in_progress","user":"teacher2"}]'::jsonb),
  (104, NULL, 104, 'in_progress', '[{"date":"2025-01-04T00:00:00.000Z","status":"in_progress","user":"teacher2"}]'::jsonb),
  (105, 105, 105, 'created', '[{"date":"2025-01-05T00:00:00.000Z","status":"created","user":"rop"}]'::jsonb),
  (106, 106, 106, 'on_teacher', '[{"date":"2025-01-06T00:00:00.000Z","status":"on_teacher","user":"rop"}]'::jsonb),
  (107, 107, 107, 'in_progress', '[{"date":"2025-01-07T00:00:00.000Z","status":"in_progress","user":"teacher3"}]'::jsonb),
  (108, 108, 108, 'in_progress', '[{"date":"2025-01-08T00:00:00.000Z","status":"in_progress","user":"teacher"}]'::jsonb),
  (109, 109, 109, 'created', '[{"date":"2025-01-09T00:00:00.000Z","status":"created","user":"rop2"}]'::jsonb);

INSERT INTO complect_sync_log (id, complect_id, user_id, source, created_at) VALUES
  (100, 100, (SELECT id FROM users WHERE name = 'rop'), '1c', '2025-02-01T00:00:00Z');
INSERT INTO template_field_changes (id, sync_log_id, id_1c_exchange, id_profile_template, field_key, old_value, new_value, applied_at) VALUES
  (100, 100, 107, 107, 'zet', '3'::jsonb, '4'::jsonb, '2025-02-01T00:00:00Z');

INSERT INTO planned_results_sets (id, complect_id) VALUES (100, 100);
INSERT INTO planned_competencies (id, set_id, competence) VALUES (100, 100, 'ТЕСТ-1 Анализировать учебные данные');
INSERT INTO planned_indicators (id, competence_id, indicator) VALUES (100, 100, 'ТЕСТ-1.1 Проверяет данные');
INSERT INTO planned_indicator_disciplines (id, indicator_id, discipline) VALUES (100, 100, 'Алгоритмы для теста');

SELECT setval(pg_get_serial_sequence('rpd_complects', 'id'), 101);
SELECT setval(pg_get_serial_sequence('rpd_1c_exchange', 'id'), 109);
SELECT setval(pg_get_serial_sequence('rpd_profile_templates', 'id'), 109);
SELECT setval(pg_get_serial_sequence('template_status', 'id'), 109);
SELECT setval(pg_get_serial_sequence('teacher_templates', 'id'), 109);
SELECT setval(pg_get_serial_sequence('user_complect', 'id'), 101);
SELECT setval(pg_get_serial_sequence('complect_sync_log', 'id'), 100);
SELECT setval(pg_get_serial_sequence('template_field_changes', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_results_sets', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_competencies', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_indicators', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_indicator_disciplines', 'id'), 100);
