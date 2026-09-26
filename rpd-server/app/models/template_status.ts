import type { Pool } from "pg";
class TemplateStatus {
  pool: Pool;
    constructor(pool: Pool) {
        this.pool = pool;
    }

    async getTemplateHistory (id: unknown) {
        try {
            const result = await this.pool.query<{ history: unknown | null }>(`
                SELECT history FROM template_status
                WHERE id_profile_template = $1
            `, [id]);

            return result.rows[0].history;
        } catch (error) {
            console.log(error);
            throw new Error(String(error), { cause: error });
        }
    }
}

export default TemplateStatus;