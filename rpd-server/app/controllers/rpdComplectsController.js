const RpdComplects = require("../models/rpd_complects");
const { USER_ROLE } = require("../../constants");

class RpdComplectsController {
  constructor(pool) {
    this.model = new RpdComplects(pool);
  }

  async findRpdComplect(req, res) {
    try {
      const { data } = req.body;
      const userId = req.user?.id;
      const record = await this.model.findRpdComplect(data, userId);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async createRpdComplect(req, res) {
    try {
      const { data } = req.body;
      const userId = req.user?.id;
      const record = await this.model.createRpdComplect({ data, userId });
      res.json(record);
    } catch (error) {
      const errorCode = error.statusCode || 500;
      res.status(errorCode).json({
        message: error.message,
        code: errorCode,
      });
    }
  }

  async getRpdComplects(req, res) {
    try {
      const currentUser = req.user;
      let records = undefined;

      if (currentUser.role === USER_ROLE.ADMIN)
        records = await this.model.getAllRpdComplects();
      else records = await this.model.getRopComplects(currentUser.id);

      res.json(records);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async deleteRbdComplect(req, res) {
    try {
      const ids = req.body;
      const records = await this.model.deleteRpdComplect(ids);
      res.json(records);
    } catch (error) {
      const errorCode = error.statusCode || 500;
      res.status(errorCode).json({
        message: error.message,
        code: errorCode,
      });
    }
  }
}

module.exports = RpdComplectsController;
