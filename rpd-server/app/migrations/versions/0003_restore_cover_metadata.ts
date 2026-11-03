import type { MigrationClient } from "../runner.ts";

// Исправляем старую должность внутри пользовательского HTML и восстанавливаем кафедру из 1С.
export async function up(client: MigrationClient): Promise<void> {
  await client.query(`
    UPDATE rpd_changeable_values
    SET value = REPLACE(value, $1, $2)
    WHERE title = 'approvalField' AND STRPOS(value, $1) > 0
  `, ["и.о. проректора по учебно-методической работе", "ПРОРЕКТОР ПО ОБРАЗОВАТЕЛЬНОЙ ДЕЯТЕЛЬНОСТИ"]);

  await client.query(`
    UPDATE rpd_profile_templates template
    SET department = exchange.department
    FROM template_status status
    JOIN rpd_1c_exchange exchange ON exchange.id = status.id_1c_template
    WHERE status.id_profile_template = template.id
      AND exchange.id_rpd_complect = template.id_rpd_complect
      AND exchange.department ~ '[^[:space:]]'
      AND template.department IS DISTINCT FROM exchange.department
  `);
}
