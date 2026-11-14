import type { Pool } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import { resolveComplect } from "../middleware/templateAuthorization.ts";
import { parsePlannedResults } from "../modules/plannedResults.ts";
import Rpd1cExchange from "../models/rpd_1c_exchange.ts";
import TemplateAccess from "./TemplateAccess.ts";

export default class PlannedResults {
  pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async get(actor: UserClaims, identifier: unknown) {
    const id = await resolveComplect(this.pool, identifier);
    await TemplateAccess.assertComplect(this.pool, actor, id, "read");
    return new Rpd1cExchange(this.pool).getResultsData(id);
  }

  async replace(actor: UserClaims, identifier: unknown, value: unknown) {
    const data = parsePlannedResults(value);
    const client = await this.pool.connect();
    let discard = false;
    try {
      await client.query("BEGIN");
      const id = await resolveComplect(client, identifier);
      await client.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [id]);
      await client.query("SELECT id FROM users WHERE id=$1 FOR SHARE", [actor.id]);
      await TemplateAccess.assertComplect(client, actor, id);
      const result = await new Rpd1cExchange(this.pool).replaceResultsData(client, data, id);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { discard = true; }
      throw error;
    } finally { client.release(discard); }
  }
}
