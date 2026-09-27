import express from "express";
const router = express.Router();
import generatePDF from "../pdf-generator/document-generator.ts";
import generateWord from "../pdf-generator/word-generator.ts";
import { pool } from "../../config/db.ts";
import TokenService from "../services/Token.ts";
import requireRole from "../middleware/requireRole.ts";
import { USER_ROLES } from "../models/constants.ts";
import RpdProfileTemplatesValidator from "../validators/RpdProfileTemplates.ts";
import TemplateWorkflowController from "../controllers/templateWorkflowController.ts";
import validateWorkflow from "../validators/TemplateWorkflow.ts";
import { complectAuthorization, templateAuthorization } from "../middleware/templateAuthorization.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import { NotFound } from "../utils/Errors.ts";
import { replaceComplectOwner } from "../services/ComplectOwnership.ts";

const template = (selector: (req: express.Request) => unknown, mode: "read" | "edit" | "manage") => templateAuthorization(pool, selector, mode);
const complect = (selector: (req: express.Request) => unknown) => complectAuthorization(pool, selector);
const byComment: express.RequestHandler = async (req, _res, next) => {
  const { rows } = await pool.query<{ id_1c_template: number }>("SELECT id_1c_template FROM template_field_comment WHERE id=$1", [req.params.id]);
  if (!rows[0]) throw new NotFound("Комментарий не найден");
  await TemplateAccess.assertTemplate(pool, TemplateAccess.actor(req.user), rows[0].id_1c_template, "edit");
  next();
};

router.get("/templates/:id/workflow", TokenService.checkAccess, TemplateWorkflowController.get);
router.post("/templates/:id/workflow", TokenService.checkAccess, validateWorkflow, TemplateWorkflowController.post);
router.get("/my-templates", TokenService.checkAccess, TemplateWorkflowController.myTemplates);
router.get("/assignable-teachers", TokenService.checkAccess, requireRole(USER_ROLES.ADMIN, USER_ROLES.ROP), TemplateWorkflowController.assignableTeachers);

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
  TokenService.checkAccess,
  rpdChangeableValuesController.updateChangeableValue.bind(
    rpdChangeableValuesController
  )
);

import RpdProfileTemplatesController from "../controllers/rpdProfileTemplatesController.ts";
const rpdProfileTemplatesController = new RpdProfileTemplatesController(pool);

router.post(
  "/rpd-profile-templates",
  TokenService.checkAccess,
  template((req) => req.body.id, "read"),
  rpdProfileTemplatesController.getJsonProfile.bind(
    rpdProfileTemplatesController
  )
);
router.put(
  "/update-json-value/:id",
  TokenService.checkAccess,
  template((req) => req.params.id, "edit"),
  rpdProfileTemplatesController.updateById.bind(rpdProfileTemplatesController)
);
router.put(
  "/rpd-profile-templates/:id/study-load",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  template((req) => req.params.id, "manage"),
  RpdProfileTemplatesValidator.studyLoad,
  rpdProfileTemplatesController.updateStudyLoad.bind(rpdProfileTemplatesController)
);
router.put(
  "/upset-template-comment/:id",
  TokenService.checkAccess,
  template((req) => req.params.id, "edit"),
  rpdProfileTemplatesController.upsetTemplateComment.bind(
    rpdProfileTemplatesController
  )
);
router.delete(
  "/delete-template-comment/:id",
  TokenService.checkAccess,
  byComment,
  rpdProfileTemplatesController.deleteTemplateComment.bind(
    rpdProfileTemplatesController
  )
);
router.post(
  "/copy-template-data",
  TokenService.checkAccess,
  template((req) => req.body.sourceTemplateId, "read"),
  template((req) => req.body.targetTemplateId, "edit"),
  rpdProfileTemplatesController.copyTemplateData.bind(
    rpdProfileTemplatesController
  )
);
router.post(
  "/copy-template-content",
  TokenService.checkAccess,
  template((req) => req.body.sourceTemplateId, "read"),
  template((req) => req.body.targetTemplateId, "edit"),
  rpdProfileTemplatesController.copyTemplateContent.bind(
    rpdProfileTemplatesController
  )
);
router.get(
  "/get-changeable-values",
  TokenService.checkAccess,
  rpdProfileTemplatesController.getChangeableValues.bind(
    rpdProfileTemplatesController
  )
);
router.post(
  "/generate-assessment-funds-docx",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  complect((req) => req.body.complectId),
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
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  complect((req) => req.body.complectId),
  rpd1cExchangeController.setResultsData.bind(rpd1cExchangeController)
);
router.post(
  "/find-rpd",
  TokenService.checkAccess,
  rpd1cExchangeController.findRpd.bind(rpd1cExchangeController)
);
router.post(
  "/create-profile-template-from-1c",
  TokenService.checkAccess,
  rpd1cExchangeController.createTemplate.bind(rpd1cExchangeController)
);
router.get(
  "/get-results-data",
  TokenService.checkAccess,
  rpd1cExchangeController.getResultsData.bind(rpd1cExchangeController)
);

import RpdComplectsController from "../controllers/rpdComplectsController.ts";
const rpdComplectsController = new RpdComplectsController(pool);

import ComplectSyncController from "../controllers/complectSyncController.ts";
const complectSyncController = new ComplectSyncController(pool);

router.post(
  "/find_rpd_complect",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  rpdComplectsController.findRpdComplect.bind(rpdComplectsController)
);
router.post(
  "/create_rpd_complect",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  rpdComplectsController.createRpdComplect.bind(rpdComplectsController)
);
router.get(
  "/get-rpd-complects",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  rpdComplectsController.getRpdComplects.bind(rpdComplectsController)
);
router.put("/complects/:id/owner", TokenService.checkAccess, requireRole(USER_ROLES.ADMIN), async (req, res) => {
  res.json(await replaceComplectOwner(pool, TemplateAccess.actor(req.user), req.params.id, req.body.userId));
});
router.post(
  "/delete_rpd_complect",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  rpdComplectsController.deleteRbdComplect.bind(rpdComplectsController)
);
router.post(
  "/complects/sync/preview",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  complect((req) => req.body.complectId),
  complectSyncController.preview.bind(complectSyncController)
);
router.post(
  "/complects/sync/apply",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  complect((req) => req.body.complectId),
  complectSyncController.apply.bind(complectSyncController)
);
router.post(
  "/acknowledge-field-changes",
  TokenService.checkAccess,
  requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN),
  complectSyncController.acknowledgeFieldChanges.bind(complectSyncController)
);
router.get("/complects/sync/changes", TokenService.checkAccess, requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN), complectSyncController.changes.bind(complectSyncController));

import TemplateStatusController from "../controllers/templateStatusController.ts";
const templateStatusController = new TemplateStatusController(pool);
router.post(
  "/get-template-history",
  TokenService.checkAccess,
  template((req) => req.body.id, "read"),
  templateStatusController.getTemplateHistory.bind(templateStatusController)
);

import findBooks from "../modules/findBooks.ts";
router.post("/find-books", findBooks);

import UsersController from "../controllers/usersController.ts";
import UsersValidator from "../validators/Users.ts";
router.get("/users", TokenService.checkAccess, requireRole(USER_ROLES.ADMIN), UsersController.list);
router.post("/users", TokenService.checkAccess, requireRole(USER_ROLES.ADMIN), UsersValidator.create, UsersController.create);
router.put("/users/:id", TokenService.checkAccess, requireRole(USER_ROLES.ADMIN), UsersValidator.update, UsersController.update);
router.patch("/users", TokenService.checkAccess, requireRole(USER_ROLES.ADMIN), UsersValidator.setActive, UsersController.setActive);

router.get("/generate-pdf", TokenService.checkAccess, template((req) => req.query.id, "read"), async (req, res) => {
    const { id } = req.query;
    const pdfBuffer = await generatePDF(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=example.pdf");

    res.send(pdfBuffer);
});

router.get("/generate-docx", TokenService.checkAccess, template((req) => req.query.id, "read"), async (req, res) => {
    const { id } = req.query;
    const docxBuffer = await generateWord(id);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", "attachment; filename=example.docx");

    res.send(docxBuffer);
});

export default router;
