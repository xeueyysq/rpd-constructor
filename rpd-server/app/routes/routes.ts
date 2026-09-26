import express from "express";
const router = express.Router();
import generatePDF from "../pdf-generator/document-generator.ts";
import generateWord from "../pdf-generator/word-generator.ts";
import { pool } from "../../config/db.ts";
import TokenService from "../services/Token.ts";

import RpdChangeableValuesController from "../controllers/rpdChangeableValuesController.ts";
const rpdChangeableValuesController = new RpdChangeableValuesController(pool);

router.get(
  "/rpd-changeable-values",
  rpdChangeableValuesController.getChangeableValues.bind(
    rpdChangeableValuesController
  )
);
router.put(
  "/rpd-changeable-values/:id",
  rpdChangeableValuesController.updateChangeableValue.bind(
    rpdChangeableValuesController
  )
);

import RpdProfileTemplatesController from "../controllers/rpdProfileTemplatesController.ts";
const rpdProfileTemplatesController = new RpdProfileTemplatesController(pool);

router.post(
  "/rpd-profile-templates",
  rpdProfileTemplatesController.getJsonProfile.bind(
    rpdProfileTemplatesController
  )
);
router.put(
  "/update-json-value/:id",
  rpdProfileTemplatesController.updateById.bind(rpdProfileTemplatesController)
);
router.put(
  "/upset-template-comment/:id",
  TokenService.checkAccess,
  rpdProfileTemplatesController.upsetTemplateComment.bind(
    rpdProfileTemplatesController
  )
);
router.delete(
  "/delete-template-comment/:id",
  TokenService.checkAccess,
  rpdProfileTemplatesController.deleteTemplateComment.bind(
    rpdProfileTemplatesController
  )
);
router.get(
  "/find-by-criteria",
  rpdProfileTemplatesController.findByCriteria.bind(
    rpdProfileTemplatesController
  )
);
router.post(
  "/find-or-create-profile-template",
  rpdProfileTemplatesController.findOrCreate.bind(rpdProfileTemplatesController)
);
router.post(
  "/copy-template-data",
  rpdProfileTemplatesController.copyTemplateData.bind(
    rpdProfileTemplatesController
  )
);
router.post(
  "/copy-template-content",
  rpdProfileTemplatesController.copyTemplateContent.bind(
    rpdProfileTemplatesController
  )
);
router.get(
  "/get-changeable-values",
  rpdProfileTemplatesController.getChangeableValues.bind(
    rpdProfileTemplatesController
  )
);
router.post(
  "/generate-assessment-funds-docx",
  rpdProfileTemplatesController.generateAssessmentFundsDocx.bind(
    rpdProfileTemplatesController
  )
);

import SpecProfilesController from "../controllers/specProfilesController.ts";
const specProfilesController = new SpecProfilesController(pool);

router.get(
  "/spec-profiles",
  specProfilesController.getProfiles.bind(specProfilesController)
);

import Rpd1cExchangeController from "../controllers/rpd1cExchangeController.ts";
const rpd1cExchangeController = new Rpd1cExchangeController(pool);

router.post(
  "/set-results-data",
  rpd1cExchangeController.setResultsData.bind(rpd1cExchangeController)
);
router.post(
  "/find-rpd",
  rpd1cExchangeController.findRpd.bind(rpd1cExchangeController)
);
router.post(
  "/create-profile-template-from-1c",
  rpd1cExchangeController.createTemplate.bind(rpd1cExchangeController)
);
router.get(
  "/get-results-data",
  rpd1cExchangeController.getResultsData.bind(rpd1cExchangeController)
);

import TeacherTemplatesController from "../controllers/teacherTemplatesController.ts";
const teacherTemplatesController = new TeacherTemplatesController(pool);

router.post(
  "/send-template-to-teacher",
  teacherTemplatesController.bindTemplateWithTeacher.bind(
    teacherTemplatesController
  )
);
router.post(
  "/find-teacher-templates",
  teacherTemplatesController.findTeacherTemplates.bind(
    teacherTemplatesController
  )
);
router.post(
  "/set-template-status",
  teacherTemplatesController.setTemplateStatus.bind(teacherTemplatesController)
);

import RpdComplectsController from "../controllers/rpdComplectsController.ts";
const rpdComplectsController = new RpdComplectsController(pool);

import ComplectSyncController from "../controllers/complectSyncController.ts";
const complectSyncController = new ComplectSyncController(pool);

router.post(
  "/find_rpd_complect",
  TokenService.checkAccess,
  rpdComplectsController.findRpdComplect.bind(rpdComplectsController)
);
router.post(
  "/create_rpd_complect",
  TokenService.checkAccess,
  rpdComplectsController.createRpdComplect.bind(rpdComplectsController)
);
router.get(
  "/get-rpd-complects",
  TokenService.checkAccess,
  rpdComplectsController.getRpdComplects.bind(rpdComplectsController)
);
router.post(
  "/delete_rpd_complect",
  rpdComplectsController.deleteRbdComplect.bind(rpdComplectsController)
);
router.post(
  "/complects/sync/preview",
  TokenService.checkAccess,
  complectSyncController.preview.bind(complectSyncController)
);
router.post(
  "/complects/sync/apply",
  TokenService.checkAccess,
  complectSyncController.apply.bind(complectSyncController)
);
router.post(
  "/acknowledge-field-changes",
  TokenService.checkAccess,
  complectSyncController.acknowledgeFieldChanges.bind(complectSyncController)
);

import TemplateStatusController from "../controllers/templateStatusController.ts";
const templateStatusController = new TemplateStatusController(pool);
router.post(
  "/get-template-history",
  templateStatusController.getTemplateHistory.bind(templateStatusController)
);

import findBooks from "../modules/findBooks.ts";
router.post("/find-books", findBooks);

import UsersController from "../controllers/usersController.ts";
const usersController = new UsersController(pool);
router.get("/get-users", usersController.findUsers.bind(usersController));
router.post("/add-user", usersController.addUser.bind(usersController));
router.post(
  "/update-user-role",
  usersController.updateUserRole.bind(usersController)
);
router.delete(
  "/delete-user/:userId",
  usersController.deleteUser.bind(usersController)
);

router.get("/generate-pdf", async (req, res) => {
  try {
    const { id } = req.query;
    const pdfBuffer = await generatePDF(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=example.pdf");

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Error generating PDF");
  }
});

router.get("/generate-docx", async (req, res) => {
  try {
    const { id } = req.query;
    const docxBuffer = await generateWord(id);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", "attachment; filename=example.docx");

    res.send(docxBuffer);
  } catch (error) {
    console.error("Error generating DOCX:", error);
    res.status(500).send("Error generating DOCX");
  }
});

export default router;
