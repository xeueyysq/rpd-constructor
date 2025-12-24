const { pool } = require("../../config/db");
const process = require("process");

(async () => {
  try {
    console.log("Starting migrations...");

    // Миграция для таблицы `rpd_complects`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rpd_complects (
        id SERIAL PRIMARY KEY,
        faculty VARCHAR(100),
        year INTEGER,
        education_form VARCHAR(100),
        education_level VARCHAR(100),
        profile VARCHAR(100),
        direction VARCHAR(100)
      )
    `);

    // Миграции для таблиц планируемых результатов
    // ВАЖНО: rpd_complects должен существовать до создания planned_results_sets из-за FK
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planned_results_sets (
        id SERIAL PRIMARY KEY,
        complect_id INT NOT NULL REFERENCES rpd_complects(id) ON DELETE CASCADE,
        UNIQUE (complect_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS planned_competencies (
        id SERIAL PRIMARY KEY,
        set_id INT NOT NULL REFERENCES planned_results_sets(id) ON DELETE CASCADE,
        competence TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS planned_indicators (
        id SERIAL PRIMARY KEY,
        competence_id INT NOT NULL REFERENCES planned_competencies(id) ON DELETE CASCADE,
        indicator TEXT NOT NULL,
        UNIQUE (competence_id, indicator)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS planned_indicator_disciplines (
        id SERIAL PRIMARY KEY,
        indicator_id INT NOT NULL REFERENCES planned_indicators(id) ON DELETE CASCADE,
        discipline TEXT NOT NULL,
        UNIQUE (indicator_id, discipline)
      )
    `);

    // Миграция для таблицы `rpd_profile_templates`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rpd_profile_templates (
        id SERIAL PRIMARY KEY,
        id_rpd_complect INT NOT NULL REFERENCES rpd_complects(id) ON DELETE CASCADE,
        disciplins_name VARCHAR(100),
        department VARCHAR(100),
        teacher VARCHAR(100),
        goals TEXT,
        place TEXT,
        semester INTEGER,
        certification TEXT,
        place_more_text TEXT,
        competencies JSONB,
        zet INTEGER,
        content JSONB,
        study_load JSONB,
        content_more_text TEXT,
        content_template_more_text TEXT,
        methodological_support_template TEXT,
        assessment_tools_template TEXT,
        textbook TEXT[],
        additional_textbook TEXT[],
        professional_information_resources TEXT,
        software TEXT,
        logistics_template TEXT
      );
    `);

    // Миграция для таблицы `rpd_1c_exchange`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rpd_1c_exchange (
        id SERIAL PRIMARY KEY,
        id_rpd_complect INT NOT NULL REFERENCES rpd_complects(id) ON DELETE CASCADE,
        department VARCHAR(100),
        discipline VARCHAR(100),
        teachers TEXT[],
        teacher VARCHAR(100),
        zet INTEGER,
        place VARCHAR(100),
        study_load JSONB,
        semester INTEGER
      );
    `);

    // Миграция для таблицы `rpd_changeable_values`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rpd_changeable_values (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        value TEXT
      );
    `);

    // Миграция для таблицы `users`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(25) UNIQUE NOT NULL,
        password VARCHAR(60) NOT NULL,
        role SMALLINT NOT NULL,
        fullname JSONB
      );
    `);

    // Миграция для таблицы `refresh_sessions`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_sessions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token VARCHAR(400) NOT NULL,
        finger_print VARCHAR(32) NOT NULL
      );
    `);

    // Миграция для таблицы `teacher_templates`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teacher_templates (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        template_id INT NOT NULL REFERENCES rpd_profile_templates(id) ON DELETE CASCADE
      );
    `);

    // Миграция для таблицы `template_status`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS template_status (
        id SERIAL PRIMARY KEY,
        id_1c_template INT REFERENCES rpd_1c_exchange(id) ON DELETE CASCADE,
        id_profile_template INT REFERENCES rpd_profile_templates(id) ON DELETE CASCADE,
        history JSONB
      )
    `);

    // Миграция для таблицы `template_field_comment`
    //TODO убрать у комментатара ключ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS template_field_comment (
        id SERIAL PRIMARY KEY,
        id_1c_template INT REFERENCES rpd_1c_exchange(id) ON DELETE CASCADE,
        commentator_id INT REFERENCES users(id) ON DELETE SET NULL,
        template_field TEXT,
        comment_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Уникальный индекс для UPSERT операции
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_template_field_comment_unique 
      ON template_field_comment(id_1c_template, template_field)
    `);

    // Функция для автоматического обновления updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Триггер для автоматического обновления updated_at при изменении записи
    await pool.query(`
      DROP TRIGGER IF EXISTS update_template_field_comment_updated_at ON template_field_comment;
      CREATE TRIGGER update_template_field_comment_updated_at
        BEFORE UPDATE ON template_field_comment
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Добавить роли пользователя (идемпотентно)
    await pool.query(`
      INSERT INTO users (name, password, role, fullname)
      VALUES (
        'rop',
        '$2a$08$sFjUzFJaMI/jCHYzolneXOuCMveOESatqTZTgn8P2rjQzSIet2Y76',
        3,
        '{
          "name": "Иван",
          "surname": "Иванов",
          "patronymic": "Иванович"
        }'
      )
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO users (name, password, role, fullname)
      VALUES (
        'teacher',
        '$2a$08$sFjUzFJaMI/jCHYzolneXOuCMveOESatqTZTgn8P2rjQzSIet2Y76',
        2,
        '{
          "name": "Татьяна",
          "surname": "Беднякова",
          "patronymic": "Михайловна"
        }'
      )
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO users (name, password, role, fullname)
      VALUES (
        'admin',
        '$2a$08$sFjUzFJaMI/jCHYzolneXOuCMveOESatqTZTgn8P2rjQzSIet2Y76',
        1,
        '{
          "name": "Админ",
          "surname": "Админов",
          "patronymic": "Админович"
        }'
      )
      ON CONFLICT (name) DO NOTHING;
    `);

    // Добавить изменяемые поля для админа (идемпотентно)
    await pool.query(`
      INSERT INTO rpd_changeable_values (title, value)
      SELECT 'uniName', 'Государственное бюджетное образовательное учреждение</br>
        высшего образования</br>
        «Университет «Дубна»</br>
        (государственный университет «Дубна»)'        
      WHERE NOT EXISTS (
        SELECT 1 FROM rpd_changeable_values WHERE title = 'uniName'
      );

      INSERT INTO rpd_changeable_values (title, value)
      SELECT 'approvalField', 'УТВЕРЖДАЮ</br>
        и.о. проректора по учебно-методической работе</br>
        __________________/ Анисимова О.В.</br>
        __________________202_ год</br>'        
      WHERE NOT EXISTS (
        SELECT 1 FROM rpd_changeable_values WHERE title = 'approvalField'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_complect (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        complect_id INT REFERENCES rpd_complects(id) ON DELETE CASCADE
      )
      `);

    console.log("Все миграции загружены успешно");
  } catch (error) {
    console.error("Ошибка загрузки миграций", error.stack);
    process.exit(1); // Выход с ошибкой
  }
})();
