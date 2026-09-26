import type { Pool } from "pg";
class RpdChangeableValues {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getChangeableValue(title: unknown) {
    try {
      const queryResult = await this.pool.query<{ id: number; title: string | null; value: string | null }>(
        "SELECT * FROM rpd_changeable_values WHERE title = $1",
        [title]
      );
      return queryResult.rows[0];
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async updateChangeableValue(id: unknown, value: unknown) {
    try {
      const queryResult = await this.pool.query<{ id: number; title: string | null; value: string | null }>(
        "UPDATE rpd_changeable_values SET value = $1 WHERE id = $2 RETURNING *",
        [value, id]
      );
      return queryResult.rows[0];
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}

export default RpdChangeableValues;
