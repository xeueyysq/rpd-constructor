const { exchange1C } = require("../modules/1cExchange");

class RpdComplects {
  constructor(pool) {
    this.pool = pool;
  }

  async findRpdComplect(data, userId) {
    try {
      const result = await this.pool.query(
        `
                SELECT rc.id 
                FROM rpd_complects rc
                INNER JOIN user_complect uc ON uc.complect_id = rc.id
                WHERE rc.faculty = $1
                AND rc.year = $2
                AND rc.education_form = $3
                AND rc.education_level = $4
                AND rc.profile = $5
                AND rc.direction = $6
                AND uc.user_id = $7
            `,
        [
          data.faculty,
          data.year,
          data.formEducation,
          data.levelEducation,
          data.profile,
          data.directionOfStudy,
          userId,
        ]
      );
      const resultId = result.rows[0];
      if (!resultId) return "NotFound";
      return resultId;
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async findRpdComplectMeta(complect_id) {
    try {
      const result = await this.pool.query(
        `
          select * from rpd_complects
          where id = $1
        `,
        [complect_id]
      );
      return result.rows[0];
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async findRpdComplectData(template_id) {
    try {
      const result = await this.pool.query(
        `
                SELECT * FROM rpd_complects
                WHERE ID = (
                    SELECT id_rpd_complect FROM rpd_profile_templates
                    WHERE id = $1
                )`,
        [template_id]
      );
      return result.rows[0];
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async createRpdComplect({ data, userId }) {
    try {
      const apiData = {
        faculty: data.faculty,
        year: data.year,
        educationLevel: data.levelEducation,
        educationForm: data.formEducation,
        profile: data.profile,
        direction: data.directionOfStudy,
      };
      const RpdComplectId = await exchange1C(apiData, { userId });
      return RpdComplectId;
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async getAllRpdComplects() {
    try {
      const result = await this.pool.query(`
            SELECT id, faculty, year, education_form as "formEducation", 
                   education_level as "levelEducation", profile, direction as "directionOfStudy"
            FROM rpd_complects
            ORDER BY id DESC
        `);
      return result.rows;
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async getRopComplects(userId) {
    try {
      const result = await this.pool.query(
        `
            SELECT rc.id,
                    rc.faculty,
                    rc.year,
                    rc.education_form as "formEducation",
                    rc.education_level as "levelEducation",
                    rc.profile,
                    rc.direction as "directionOfStudy"
            FROM rpd_complects rc
            INNER JOIN user_complect uc ON uc.complect_id = rc.id
            WHERE uc.user_id = $1
            ORDER BY rc.id DESC
            `,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async deleteRpdComplect(ids) {
    try {
      const result = await this.pool.query(
        `
                DELETE FROM rpd_complects
                WHERE id = ANY($1)`,
        [ids]
      );
      return result;
    } catch (error) {
      console.error(error);
      throw new Error(error);
    }
  }
}

module.exports = RpdComplects;
