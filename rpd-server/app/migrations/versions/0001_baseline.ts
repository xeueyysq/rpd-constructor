import type { MigrationClient } from "../runner.ts";
import { deriveStatus, type TemplateStatus } from "../../modules/templateWorkflow.ts";
import { matchTeacherNames, splitNames } from "../../modules/teacherNames.ts";

type StatusRow = { id: number; id_1c_template: number | null; id_profile_template: number | null; history: unknown; current_status: string | null };
const statusCodes = new Set(["unloaded", "created", "on_teacher", "in_progress", "ready", "on_refinement"]);

function historyEvents(value: unknown, id: number): Record<string, unknown>[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) throw new Error(`Некорректная история template_status ${id}`);
  return value as Record<string, unknown>[];
}

function legacyState(status: string | null): string {
  return status === "ready" ? "done" : status === "in_progress" ? "in_progress" : "assigned";
}

async function migrateTeacherWorkflow(client: MigrationClient) {
    const { rows: stateColumn } = await client.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='teacher_templates' AND column_name='state') AS exists");
    const stateIsNew = !stateColumn[0]?.exists;
    await client.query("ALTER TABLE teacher_templates ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'assigned', ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
    await client.query("ALTER TABLE teacher_templates DROP CONSTRAINT IF EXISTS teacher_templates_state_check");
    await client.query("ALTER TABLE teacher_templates ADD CONSTRAINT teacher_templates_state_check CHECK (state IN ('assigned','in_progress','done'))");
    await client.query("DELETE FROM teacher_templates dup USING teacher_templates keep WHERE dup.user_id=keep.user_id AND dup.template_id=keep.template_id AND dup.id>keep.id");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_templates_pair ON teacher_templates(user_id,template_id)");
    await client.query("ALTER TABLE template_status ADD COLUMN IF NOT EXISTS current_status TEXT");

    const { rows: allStatuses } = await client.query<StatusRow>(`SELECT id,id_1c_template,id_profile_template,history,current_status FROM template_status
      WHERE id_1c_template IN (SELECT id_1c_template FROM template_status WHERE id_1c_template IS NOT NULL GROUP BY id_1c_template HAVING COUNT(*) > 1)
         OR id_profile_template IN (SELECT id_profile_template FROM template_status WHERE id_profile_template IS NOT NULL GROUP BY id_profile_template HAVING COUNT(*) > 1)
      ORDER BY id FOR UPDATE`);
    const groups: StatusRow[][] = [];
    for (const row of allStatuses) {
      const matching = groups.filter((group) => group.some((item) => row.id_1c_template !== null && item.id_1c_template === row.id_1c_template || row.id_profile_template !== null && item.id_profile_template === row.id_profile_template));
      const combined = [row, ...matching.flat()];
      for (const group of matching) groups.splice(groups.indexOf(group), 1);
      groups.push(combined);
    }
    for (const group of groups) {
      const oneC = [...new Set(group.map((row) => row.id_1c_template).filter((id): id is number => id !== null))];
      const profiles = [...new Set(group.map((row) => row.id_profile_template).filter((id): id is number => id !== null))];
      if (oneC.length > 1 || profiles.length > 1) throw new Error(`Конфликт ссылок template_status ID: ${group.map((row) => row.id).join(", ")}`);
      const ordered = group.sort((a, b) => a.id - b.id);
      const events = ordered.flatMap((row) => historyEvents(row.history, row.id));
      if (ordered.length > 1) events.sort((a, b) => {
        const first = typeof a.date === "string" ? Date.parse(a.date) : NaN;
        const second = typeof b.date === "string" ? Date.parse(b.date) : NaN;
        return Number.isFinite(first) && Number.isFinite(second) ? first - second : String(a.date ?? "").localeCompare(String(b.date ?? ""));
      });
      const keep = ordered[0];
      if (ordered.length > 1) await client.query("DELETE FROM template_status WHERE id = ANY($1::int[])", [ordered.slice(1).map((row) => row.id)]);
      const last = events.at(-1)?.status;
      if (last !== undefined && (typeof last !== "string" || !statusCodes.has(last))) throw new Error(`Неизвестный статус template_status ${keep.id}: ${String(last)}`);
      const status = typeof last === "string" && statusCodes.has(last) ? last : profiles.length ? "created" : "unloaded";
      if (last === undefined) events.push({ date: new Date().toISOString(), status, action: "migration", user: "Система" });
      await client.query("UPDATE template_status SET id_1c_template=$1,id_profile_template=$2,history=$3::jsonb,current_status=$4 WHERE id=$5", [oneC[0] ?? null, profiles[0] ?? null, JSON.stringify(events), status, keep.id]);
    }
    const { rows: invalidHistory } = await client.query<{ id: number }>("SELECT id FROM template_status WHERE current_status IS NULL AND history IS NOT NULL AND jsonb_typeof(history)<>'array' LIMIT 1");
    if (invalidHistory[0]) throw new Error(`Некорректная история template_status ${invalidHistory[0].id}`);
    const { rows: invalidEvents } = await client.query<{ id: number }>("SELECT ts.id FROM template_status ts CROSS JOIN LATERAL jsonb_array_elements(ts.history) AS item(value) WHERE ts.current_status IS NULL AND jsonb_typeof(item.value)<>'object' LIMIT 1");
    if (invalidEvents[0]) throw new Error(`Некорректная история template_status ${invalidEvents[0].id}`);
    const { rows: invalidStatuses } = await client.query<{ id: number; status: string }>(`SELECT id,history->-1->>'status' AS status FROM template_status
      WHERE current_status IS NULL AND history->-1->>'status' IS NOT NULL
        AND history->-1->>'status' <> ALL($1::text[])`, [[...statusCodes]]);
    if (invalidStatuses.length) throw new Error(`Неизвестный статус template_status ${invalidStatuses[0].id}: ${invalidStatuses[0].status}`);
    await client.query(`UPDATE template_status SET
      current_status=COALESCE(history->-1->>'status', CASE WHEN id_profile_template IS NOT NULL THEN 'created' ELSE 'unloaded' END),
      history=CASE WHEN jsonb_typeof(history)='array' AND jsonb_array_length(history)>0 THEN history
        ELSE jsonb_build_array(jsonb_build_object('date',NOW(),'status',CASE WHEN id_profile_template IS NOT NULL THEN 'created' ELSE 'unloaded' END,'action','migration','user','Система')) END
      WHERE current_status IS NULL`);
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_template_status_profile ON template_status(id_profile_template) WHERE id_profile_template IS NOT NULL");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_template_status_1c ON template_status(id_1c_template) WHERE id_1c_template IS NOT NULL");
    await client.query("INSERT INTO template_status(id_profile_template,history,current_status) SELECT rpt.id,$1::jsonb,'created' FROM rpd_profile_templates rpt WHERE NOT EXISTS (SELECT 1 FROM template_status ts WHERE ts.id_profile_template=rpt.id)", [JSON.stringify([{ date: new Date().toISOString(), status: "created", action: "migration", user: "Система" }])]);
    if (stateIsNew) await client.query("UPDATE teacher_templates tt SET state=CASE ts.current_status WHEN 'ready' THEN 'done' WHEN 'in_progress' THEN 'in_progress' ELSE 'assigned' END FROM template_status ts WHERE ts.id_profile_template=tt.template_id");

    const { rows: teacherColumn } = await client.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rpd_profile_templates' AND column_name='teacher') AS exists");
    const { rows: exchangeTeacherColumn } = await client.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rpd_1c_exchange' AND column_name='teacher') AS exists");
    if (teacherColumn[0]?.exists || exchangeTeacherColumn[0]?.exists) {
      const { rows: users } = await client.query<{ id: number; fullname: unknown }>("SELECT id,fullname FROM users WHERE role=ANY($1::int[])", [[2, 3]]);
      const profileTeacher = teacherColumn[0]?.exists ? "rpt.teacher" : "NULL::text";
      const exchangeTeacher = exchangeTeacherColumn[0]?.exists ? "r.teacher" : "NULL::text";
      const { rows: legacy } = await client.query<{ id: number; profile_teacher: string | null; exchange_teacher: string | null; status: string | null }>(`SELECT rpt.id,${profileTeacher} AS profile_teacher,${exchangeTeacher} AS exchange_teacher,ts.current_status AS status FROM rpd_profile_templates rpt LEFT JOIN template_status ts ON ts.id_profile_template=rpt.id LEFT JOIN rpd_1c_exchange r ON r.id=ts.id_1c_template`);
      for (const row of legacy) {
        const names = splitNames([row.profile_teacher, row.exchange_teacher]);
        for (const match of matchTeacherNames(names, users)) {
          if (match.userId === null) {
            console.warn(`Не сопоставлен преподаватель: шаблон ${row.id}, ФИО «${match.name}»${match.ambiguous ? " (неоднозначно)" : ""}`);
            continue;
          }
          await client.query("INSERT INTO teacher_templates(user_id,template_id,state) VALUES($1,$2,$3) ON CONFLICT(user_id,template_id) DO NOTHING", [match.userId, row.id, legacyState(row.status)]);
        }
      }
    }
    const { rows: templates } = await client.query<{ id: number; current_status: TemplateStatus }>("SELECT id_profile_template AS id,current_status FROM template_status WHERE id_profile_template IS NOT NULL");
    for (const template of templates) {
      const { rows: participants } = await client.query<{ userId: number; state: "assigned" | "in_progress" | "done"; isActive: boolean }>("SELECT tt.user_id AS \"userId\",tt.state,u.is_active AS \"isActive\" FROM teacher_templates tt JOIN users u ON u.id=tt.user_id WHERE tt.template_id=$1", [template.id]);
      const next = deriveStatus(template.current_status, participants);
      if (next !== template.current_status) await client.query("UPDATE template_status SET current_status=$1,history=COALESCE(history,'[]'::jsonb)||$2::jsonb WHERE id_profile_template=$3", [next, JSON.stringify([{ date: new Date().toISOString(), status: next, action: "migration", user: "Система" }]), template.id]);
    }
    await client.query("ALTER TABLE rpd_profile_templates DROP COLUMN IF EXISTS teacher");
    await client.query("ALTER TABLE rpd_1c_exchange DROP COLUMN IF EXISTS teacher");
}

export async function up(client: MigrationClient): Promise<void> {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `);

  // Миграция для таблицы `rpd_complects`
  await client.query(`
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
  await client.query(`
    CREATE TABLE IF NOT EXISTS planned_results_sets (
      id SERIAL PRIMARY KEY,
      complect_id INT NOT NULL REFERENCES rpd_complects(id) ON DELETE CASCADE,
      UNIQUE (complect_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS planned_competencies (
      id SERIAL PRIMARY KEY,
      set_id INT NOT NULL REFERENCES planned_results_sets(id) ON DELETE CASCADE,
      competence TEXT NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS planned_indicators (
      id SERIAL PRIMARY KEY,
      competence_id INT NOT NULL REFERENCES planned_competencies(id) ON DELETE CASCADE,
      indicator TEXT NOT NULL,
      UNIQUE (competence_id, indicator)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS planned_indicator_disciplines (
      id SERIAL PRIMARY KEY,
      indicator_id INT NOT NULL REFERENCES planned_indicators(id) ON DELETE CASCADE,
      discipline TEXT NOT NULL,
      UNIQUE (indicator_id, discipline)
    )
  `);

  // Миграция для таблицы `rpd_profile_templates`
  await client.query(`
    CREATE TABLE IF NOT EXISTS rpd_profile_templates (
      id SERIAL PRIMARY KEY,
      id_rpd_complect INT NOT NULL REFERENCES rpd_complects(id) ON DELETE CASCADE,
      disciplins_name TEXT,
      department TEXT,
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
      logistics_template TEXT,
      field_edits JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `);

  // Миграция для таблицы `rpd_1c_exchange`
  await client.query(`
    CREATE TABLE IF NOT EXISTS rpd_1c_exchange (
      id SERIAL PRIMARY KEY,
      id_rpd_complect INT NOT NULL REFERENCES rpd_complects(id) ON DELETE CASCADE,
      department TEXT,
      discipline TEXT,
      teachers TEXT[],
      zet INTEGER,
      place TEXT,
      record_type TEXT,
      study_load JSONB,
      semester INTEGER
    );
  `);

  await client.query(`
    ALTER TABLE rpd_1c_exchange
      ALTER COLUMN department TYPE TEXT,
      ALTER COLUMN discipline TYPE TEXT,
      ALTER COLUMN place TYPE TEXT;
  `);

  await client.query(`
    ALTER TABLE rpd_profile_templates
      ALTER COLUMN disciplins_name TYPE TEXT,
      ALTER COLUMN department TYPE TEXT;
  `);

  await client.query(`
    ALTER TABLE rpd_1c_exchange
      ADD COLUMN IF NOT EXISTS control_load JSONB;
  `);
  await client.query(`
    ALTER TABLE rpd_1c_exchange
      ADD COLUMN IF NOT EXISTS record_type TEXT;
  `);
  await client.query(`
    ALTER TABLE rpd_profile_templates
      ADD COLUMN IF NOT EXISTS control_load JSONB;
  `);
  await client.query(`
    ALTER TABLE rpd_profile_templates
      ADD COLUMN IF NOT EXISTS field_edits JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await client.query(`
    ALTER TABLE rpd_profile_templates
      ADD COLUMN IF NOT EXISTS assessment_tools_questions JSONB;
  `);

  // Миграция для таблицы `rpd_changeable_values`
  await client.query(`
    CREATE TABLE IF NOT EXISTS rpd_changeable_values (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      value TEXT
    );
  `);

  // Миграция для таблицы `users`
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(25) UNIQUE NOT NULL,
      password VARCHAR(60) NOT NULL,
      role SMALLINT NOT NULL,
      fullname JSONB
    );
  `);
  await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true");

  // Миграция для таблицы `refresh_sessions`
  await client.query(`
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token VARCHAR(400) NOT NULL,
      finger_print VARCHAR(32) NOT NULL
    );
  `);

  // Миграция для таблицы `teacher_templates`
  await client.query(`
    CREATE TABLE IF NOT EXISTS teacher_templates (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id INT NOT NULL REFERENCES rpd_profile_templates(id) ON DELETE CASCADE
    );
  `);

  // Миграция для таблицы `template_status`
  await client.query(`
    CREATE TABLE IF NOT EXISTS template_status (
      id SERIAL PRIMARY KEY,
      id_1c_template INT REFERENCES rpd_1c_exchange(id) ON DELETE CASCADE,
      id_profile_template INT REFERENCES rpd_profile_templates(id) ON DELETE CASCADE,
      history JSONB
    )
  `);

  // Миграция для таблицы `template_field_comment`
  await client.query(`
    CREATE TABLE IF NOT EXISTS template_field_comment (
      id SERIAL PRIMARY KEY,
      id_profile_template INT NOT NULL REFERENCES rpd_profile_templates(id) ON DELETE CASCADE,
      commentator_id INT REFERENCES users(id) ON DELETE SET NULL,
      template_field TEXT,
      comment_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const { rows: oldColumn } = await client.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='template_field_comment' AND column_name='id_1c_template') AS exists");
  if (oldColumn[0]?.exists) await client.query("ALTER TABLE template_field_comment RENAME COLUMN id_1c_template TO id_profile_template");

  const { rows: oldKeys } = await client.query<{ name: string }>("SELECT quote_ident(conname) AS name FROM pg_constraint WHERE conrelid='template_field_comment'::regclass AND confrelid='rpd_1c_exchange'::regclass AND contype='f'");
  for (const key of oldKeys) await client.query(`ALTER TABLE template_field_comment DROP CONSTRAINT ${key.name}`);

  const { rows: removedComments } = await client.query<{ id: number }>("DELETE FROM template_field_comment tfc WHERE id_profile_template IS NULL OR NOT EXISTS (SELECT 1 FROM rpd_profile_templates rpt WHERE rpt.id=tfc.id_profile_template) RETURNING tfc.id");
  if (removedComments.length) console.warn(`Удалены комментарии без профильного шаблона (${removedComments.length}): ${removedComments.map((row) => row.id).join(", ")}`);
  await client.query("ALTER TABLE template_field_comment ALTER COLUMN id_profile_template SET NOT NULL");

  const { rows: profileKey } = await client.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='template_field_comment'::regclass AND confrelid='rpd_profile_templates'::regclass AND contype='f') AS exists");
  if (!profileKey[0]?.exists) await client.query("ALTER TABLE template_field_comment ADD CONSTRAINT template_field_comment_id_profile_template_fkey FOREIGN KEY (id_profile_template) REFERENCES rpd_profile_templates(id) ON DELETE CASCADE");

  // Уникальный индекс для UPSERT операции
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_template_field_comment_unique ON template_field_comment(id_profile_template, template_field)");

  // Функция для автоматического обновления updated_at
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Триггер для автоматического обновления updated_at при изменении записи
  await client.query(`
    DROP TRIGGER IF EXISTS update_template_field_comment_updated_at ON template_field_comment;
    CREATE TRIGGER update_template_field_comment_updated_at
      BEFORE UPDATE ON template_field_comment
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  // Добавить роли пользователя (идемпотентно)
  await client.query(`
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
  await client.query(`
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

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_complect (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      complect_id INT REFERENCES rpd_complects(id) ON DELETE CASCADE
    )
    `);

  await client.query(`
    ALTER TABLE rpd_complects
      ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid();
  `);

  await client.query(`
    ALTER TABLE rpd_complects
      ALTER COLUMN uuid SET NOT NULL;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rpd_complects_uuid
      ON rpd_complects (uuid);
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rpd_complects_business
      ON rpd_complects (
        faculty,
        year,
        education_form,
        education_level,
        profile,
        direction
      );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_complect_unique
      ON user_complect (user_id, complect_id);
  `);

  // Короткий публичный id для шаблонов (12 hex-символов)
  await client.query(`
    ALTER TABLE rpd_profile_templates
      ADD COLUMN IF NOT EXISTS public_id VARCHAR(12);
  `);
  await client.query(`
    UPDATE rpd_profile_templates
      SET public_id = encode(gen_random_bytes(6), 'hex')
      WHERE public_id IS NULL;
  `);
  await client.query(`
    ALTER TABLE rpd_profile_templates
      ALTER COLUMN public_id SET NOT NULL;
  `);
  await client.query(`
    ALTER TABLE rpd_profile_templates
      ALTER COLUMN public_id SET DEFAULT encode(gen_random_bytes(6), 'hex');
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rpd_profile_templates_public_id
      ON rpd_profile_templates (public_id);
  `);

  // Удаление дублей дисциплин 1С перед уникальным индексом (повторная выгрузка комплекта)
  const { rows: conflictingExchanges } = await client.query<{ ids: number[] }>(`
    SELECT array_agg(r.id ORDER BY r.id) AS ids
    FROM rpd_1c_exchange r LEFT JOIN template_status ts ON ts.id_1c_template=r.id
    WHERE r.discipline IS NOT NULL
    GROUP BY r.id_rpd_complect,r.discipline,r.semester,COALESCE(r.record_type,'')
    HAVING COUNT(DISTINCT ts.id_profile_template)>1
    LIMIT 1
  `);
  if (conflictingExchanges[0]) throw new Error(`Конфликт связей дисциплин 1С ID: ${conflictingExchanges[0].ids.join(", ")}`);
  await client.query(`
    UPDATE template_status ts SET id_1c_template = keep.id
    FROM rpd_1c_exchange dup, rpd_1c_exchange keep
    WHERE dup.id > keep.id
      AND keep.id = (
        SELECT MIN(candidate.id) FROM rpd_1c_exchange candidate
        WHERE candidate.id_rpd_complect=dup.id_rpd_complect
          AND candidate.discipline=dup.discipline
          AND candidate.semester IS NOT DISTINCT FROM dup.semester
          AND COALESCE(candidate.record_type,'')=COALESCE(dup.record_type,'')
      )
      AND dup.id_rpd_complect = keep.id_rpd_complect
      AND dup.discipline = keep.discipline
      AND dup.semester IS NOT DISTINCT FROM keep.semester
      AND COALESCE(dup.record_type, '') = COALESCE(keep.record_type, '')
      AND ts.id_1c_template = dup.id;
  `);

  await client.query(`
    DELETE FROM rpd_1c_exchange dup
    USING rpd_1c_exchange keep
    WHERE dup.id > keep.id
      AND dup.id_rpd_complect = keep.id_rpd_complect
      AND dup.discipline = keep.discipline
      AND dup.semester IS NOT DISTINCT FROM keep.semester
      AND COALESCE(dup.record_type, '') = COALESCE(keep.record_type, '');
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rpd_1c_exchange_discipline_unique
      ON rpd_1c_exchange (
        id_rpd_complect,
        discipline,
        COALESCE(semester, -1),
        COALESCE(record_type, '')
      );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS spec_profiles_cache (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      raw_payload JSONB NOT NULL,
      tree_payload JSONB NOT NULL,
      payload_hash TEXT NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    ALTER TABLE rpd_complects
      ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS has_pending_changes BOOLEAN NOT NULL DEFAULT false;
  `);

  await client.query(`
    ALTER TABLE rpd_1c_exchange
      ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS complect_sync_log (
      id SERIAL PRIMARY KEY,
      complect_id INT NOT NULL REFERENCES rpd_complects(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      source VARCHAR(16) NOT NULL CHECK (source IN ('1c', 'manual')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS template_field_changes (
      id SERIAL PRIMARY KEY,
      sync_log_id INT NOT NULL REFERENCES complect_sync_log(id) ON DELETE CASCADE,
      id_1c_exchange INT NOT NULL REFERENCES rpd_1c_exchange(id) ON DELETE CASCADE,
      id_profile_template INT REFERENCES rpd_profile_templates(id) ON DELETE SET NULL,
      field_key VARCHAR(64) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_complect_sync_log_complect_id
      ON complect_sync_log (complect_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_template_field_changes_profile_template
      ON template_field_changes (id_profile_template)
      WHERE id_profile_template IS NOT NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_template_field_changes_unacknowledged
      ON template_field_changes (id_profile_template, id_1c_exchange)
      WHERE acknowledged_at IS NULL;
  `);

  await migrateTeacherWorkflow(client);
}
