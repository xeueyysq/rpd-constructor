import type { MigrationClient } from "../runner.ts";

// Назначаемые карточки без доступа. Ключ реестра — нормализованная подпись
// источника, НЕ внешний ID человека и НЕ глобальная уникальность ФИО users.
export async function up(client: MigrationClient): Promise<void> {
  await client.query(`
    ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
    ALTER TABLE users ADD CONSTRAINT users_credentials_pair CHECK (
      (name IS NULL AND password IS NULL) OR
      (name IS NOT NULL AND password IS NOT NULL AND length(btrim(name)) > 0 AND length(password) > 0)
    );
    CREATE TABLE teacher_source_cards (
      source TEXT NOT NULL CHECK (source = '1c-fullname-v1'),
      label_key TEXT NOT NULL,
      label TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      PRIMARY KEY (source, label_key)
    );
  `);
}
