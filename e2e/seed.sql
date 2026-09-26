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
  (12, 'retired', '$2b$08$19oXcVS2/xt8y7H73RhQ4uws75CgyFFw9QuRe9oxX/1cDhRqUcbza', 2, '{"surname":"Уходов","name":"Тест","patronymic":"Тестович"}');
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users));

INSERT INTO rpd_complects (id, uuid, faculty, year, education_form, education_level, profile, direction) VALUES
  (100, '11111111-1111-4111-8111-111111111111', 'Тестовый институт', 2025, 'Очная', 'Бакалавриат', 'Синтетический профиль', 'Тестовое направление');
INSERT INTO user_complect (id, user_id, complect_id)
  SELECT 100, id, 100 FROM users WHERE name = 'rop';

INSERT INTO rpd_1c_exchange (id, id_rpd_complect, department, discipline, teachers, teacher, zet, place, record_type, study_load, control_load, semester) VALUES
  (100, 100, 'Тестовая кафедра', 'Алгоритмы для теста', ARRAY['Альфина Тест Тестовна'], 'Альфина Тест Тестовна', 3, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 1),
  (101, 100, 'Тестовая кафедра', 'Базы данных для теста', ARRAY['Альфина Тест Тестовна'], 'Альфина Тест Тестовна', 4, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 2),
  (102, 100, 'Тестовая кафедра', 'Сети для теста', ARRAY['Яковлева Тест Тестовна'], 'Яковлева Тест Тестовна', 2, 'Базовая часть', 'discipline', '{}'::jsonb, '{}'::jsonb, 3),
  (103, 100, 'Тестовая кафедра', 'Часы для теста', ARRAY['Яковлева Тест Тестовна'], 'Яковлева Тест Тестовна', 4, 'Базовая часть', 'discipline', '{"Всего":"144","Лекции":"34","Практика":"26","Лабораторные":"8","Контроль":"45","СРС":"31","КРП":"0"}'::jsonb, '{"Экзамен":"да"}'::jsonb, 4);
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, teacher, semester, zet, competencies, content, study_load, control_load, assessment_tools_questions) VALUES
  (100, 'aaaaaaaaaaaa', 100, 'Алгоритмы для теста', 'Тестовая кафедра', 'Альфина Тест Тестовна', 1, 3, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (101, 'bbbbbbbbbbbb', 100, 'Базы данных для теста', 'Тестовая кафедра', 'Альфина Тест Тестовна', 2, 4, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  (103, 'cccccccccccc', 100, 'Часы для теста', 'Тестовая кафедра', 'Яковлева Тест Тестовна', 4, 4, '{}'::jsonb, '{"0":{"theme":"Тема 1","lectures":17,"seminars":17,"control":0,"independent_work":15},"1":{"theme":"Тема 2","lectures":17,"seminars":17,"control":0,"independent_work":16},"__attestation__":{"theme":"Промежуточная аттестация: экзамен","lectures":0,"seminars":0,"control":45,"independent_work":0}}'::jsonb, '{"Всего":"144","Лекции":"34","Практика":"26","Лабораторные":"8","Контроль":"45","СРС":"31","КРП":"0"}'::jsonb, '{"Экзамен":"да"}'::jsonb, '{}'::jsonb);
UPDATE rpd_profile_templates SET certification = 'Экзамен' WHERE id = 103;
-- Копия для API-проверок без привязки к спискам UI.
INSERT INTO rpd_profile_templates (id, public_id, id_rpd_complect, disciplins_name, department, teacher, semester, zet, certification, competencies, content, study_load, control_load, assessment_tools_questions)
  SELECT 104, 'dddddddddddd', id_rpd_complect, disciplins_name, department, teacher, semester, zet, certification, competencies, content, study_load, control_load, assessment_tools_questions
  FROM rpd_profile_templates WHERE id = 103;
INSERT INTO teacher_templates (id, user_id, template_id)
  SELECT 100, id, 100 FROM users WHERE name = 'teacher';
INSERT INTO teacher_templates (id, user_id, template_id)
  SELECT 101, id, 101 FROM users WHERE name = 'teacher';
INSERT INTO teacher_templates (id, user_id, template_id)
  SELECT 102, id, 100 FROM users WHERE name = 'retired';
INSERT INTO teacher_templates (id, user_id, template_id)
  SELECT 103, id, 103 FROM users WHERE name = 'teacher2';
INSERT INTO template_status (id, id_1c_template, id_profile_template, history) VALUES
  (100, 100, 100, '[{"date":"2025-01-01T00:00:00.000Z","status":"in_progress","user":"teacher"}]'::jsonb),
  (101, 101, 101, '[{"date":"2025-01-02T00:00:00.000Z","status":"ready","user":"teacher"}]'::jsonb),
  (102, 102, NULL, '[{"date":"2025-01-03T00:00:00.000Z","status":"unloaded","user":"rop"}]'::jsonb),
  (103, 103, 103, '[{"date":"2025-01-04T00:00:00.000Z","status":"in_progress","user":"teacher2"}]'::jsonb);

INSERT INTO planned_results_sets (id, complect_id) VALUES (100, 100);
INSERT INTO planned_competencies (id, set_id, competence) VALUES (100, 100, 'ТЕСТ-1 Анализировать учебные данные');
INSERT INTO planned_indicators (id, competence_id, indicator) VALUES (100, 100, 'ТЕСТ-1.1 Проверяет данные');
INSERT INTO planned_indicator_disciplines (id, indicator_id, discipline) VALUES (100, 100, 'Алгоритмы для теста');

SELECT setval(pg_get_serial_sequence('rpd_complects', 'id'), 100);
SELECT setval(pg_get_serial_sequence('rpd_1c_exchange', 'id'), 103);
SELECT setval(pg_get_serial_sequence('rpd_profile_templates', 'id'), 104);
SELECT setval(pg_get_serial_sequence('template_status', 'id'), 103);
SELECT setval(pg_get_serial_sequence('teacher_templates', 'id'), 103);
SELECT setval(pg_get_serial_sequence('user_complect', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_results_sets', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_competencies', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_indicators', 'id'), 100);
SELECT setval(pg_get_serial_sequence('planned_indicator_disciplines', 'id'), 100);
