class Users {
    constructor (pool) {
        this.pool = pool;
    }

    async findUsers() {
        try {
            const result = await this.pool.query(`
                SELECT id, name, role, fullname 
                FROM users 
                WHERE role != 1
                ORDER BY role DESC, name
            `);
            return result.rows.length ? result.rows : [];
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    async addUser(data) {
        try {
            await this.pool.query(`
                INSERT INTO users (name, password, role, fullname)
                VALUES ($1, $2, $3, $4)
                `, [
                    data.username,
                    data.hashedPassword,
                    data.role,
                    data.fullname
                ]);
        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }
}

module.exports = Users;