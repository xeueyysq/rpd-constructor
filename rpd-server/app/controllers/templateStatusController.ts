// @ts-nocheck: типизация существующего кода — следующий пакет
import TemplateStatus from "../models/template_status.ts";

class TemplateStatusController {
    constructor(pool) {
        this.model = new TemplateStatus(pool);
    }   

    async getTemplateHistory (req, res) {
        try {
            const { id } = req.body;
            const record = await this.model.getTemplateHistory(id);
            res.json(record);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

export default TemplateStatusController;