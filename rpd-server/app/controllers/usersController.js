const Users = require('../models/users')
const bcrypt = require('bcrypt');

class UsersController {
    constructor (pool) {
        this.model = new Users(pool);
    };

    async findUsers (req, res) {
        try {
            const record = await this.model.findUsers();
            res.json(record)
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async addUser (req, res) {
        try {
            const { newUser } = req.body;
            newUser.hashedPassword = await bcrypt.hash(newUser.hashedPassword, 10);
            
            const record = await this.model.addUser(newUser);
            res.json(record)
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = UsersController;