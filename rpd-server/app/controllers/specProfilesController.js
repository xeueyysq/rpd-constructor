const { syncAndGetSpecProfiles } = require("../modules/1cExchange");

class SpecProfilesController {
  constructor(pool) {
    this.pool = pool;
  }

  async getProfiles(_req, res) {
    try {
      const result = await syncAndGetSpecProfiles(this.pool);
      res.json(result);
    } catch (error) {
      console.error("spec-profiles error:", error);
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = SpecProfilesController;
