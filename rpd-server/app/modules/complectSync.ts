import type { PoolClient } from "pg";
import type { Rpd1cExchangeRow, RpdComplectRow } from "../types/db.ts";
import moment from "moment";
import { pool } from "../../config/db.ts";
import { fetchUpLink } from "./1cExchange.ts";
import { normalizeDisciplineFrom1c } from "./normalizeDisciplineFrom1c.ts";
import { stableSerialize } from "./specProfilesMapping.ts";

const SYNC_FIELDS = [
  "discipline",
  "department",
  "semester",
  "zet",
  "place",
  "study_load",
  "control_load",
  "teachers",
];

const TEMPLATE_FIELD_MAP: Record<string, string> = {
  discipline: "disciplins_name",
  department: "department",
  semester: "semester",
  zet: "zet",
  place: "place",
  study_load: "study_load",
  control_load: "control_load",
};

const TEMPLATE_SYNC_FIELDS = new Set(Object.keys(TEMPLATE_FIELD_MAP));

const NEW_DISCIPLINE_MARKER = "__new__";

type LocalRow = {
  id: number;
  id_rpd_complect: number;
  department: string;
  discipline: string;
  teachers: string[];
  zet: number | null;
  place: string;
  record_type: string;
  study_load: unknown;
  control_load: unknown;
  semester: number | null;
  removed_at: Date | null;
  id_profile_template: number | null;
  [key: string]: unknown;
};
type IncomingRow = ReturnType<typeof normalizeDisciplineFrom1c> & Record<string, unknown>;
type FieldChange = { field: string; old: unknown; new: unknown };
type DiffResult = {
  new: { key: string; incoming: IncomingRow; fields: FieldChange[] }[];
  updated: { id_1c: number; key: string; local: LocalRow; incoming: IncomingRow; fields: FieldChange[]; hasProfileTemplate: boolean }[];
  removed: { id_1c: number; key: string; local: LocalRow; hasProfileTemplate: boolean }[];
  unchanged: { id_1c: number; key: string; local: LocalRow; incoming: IncomingRow; hasProfileTemplate: boolean }[];
};
type Selection = { action: string; id_1c?: number; incoming?: IncomingRow; fields?: string[] };
type FieldChangeInput = { syncLogId: number; id1c: number; idProfileTemplate: number | null; fieldKey: string; oldValue: unknown; newValue: unknown };


const parseJsonField = (value: unknown) => {
  if (value == null) return value;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const normalizeLocalRow = (row: Rpd1cExchangeRow & { id_profile_template: number | null }): LocalRow => ({
  id: row.id,
  id_rpd_complect: row.id_rpd_complect,
  department: row.department ?? "",
  discipline: (row.discipline || "").trim(),
  teachers: Array.isArray(row.teachers) ? row.teachers : [],
  zet: row.zet ?? null,
  place: row.place ?? "",
  record_type: row.record_type ?? "",
  study_load: parseJsonField(row.study_load) ?? {},
  control_load: parseJsonField(row.control_load) ?? {},
  semester: row.semester ?? null,
  removed_at: row.removed_at ?? null,
  id_profile_template: row.id_profile_template ?? null,
});

const matchDisciplineKey = (row: { discipline: string; semester: number | null; record_type: string }) =>
  `${(row.discipline || "").trim()}|${row.semester ?? ""}|${row.record_type ?? ""}`;

const valuesEqual = (a: unknown, b: unknown) => stableSerialize(a) === stableSerialize(b);

const deriveCertification = (controlLoad: unknown) => {
  if (
    !controlLoad ||
    typeof controlLoad !== "object" ||
    Array.isArray(controlLoad)
  ) {
    return null;
  }
  const keys = Object.keys(controlLoad);
  return keys.length > 0 ? keys[0] : null;
};

const buildComplectApiData = (complectMeta: RpdComplectRow) => ({
  faculty: complectMeta.faculty,
  year: complectMeta.year,
  educationForm: complectMeta.education_form,
  educationLevel: complectMeta.education_level,
  profile: complectMeta.profile,
  direction: complectMeta.direction,
});

const loadLocalDisciplines = async (complectId: number) => {
  const { rows } = await pool.query<Rpd1cExchangeRow & { id_profile_template: number | null } & Record<string, unknown>>(
    `
      SELECT
        r.id,
        r.id_rpd_complect,
        r.department,
        r.discipline,
        r.teachers,
        r.zet,
        r.place,
        r.record_type,
        r.study_load,
        r.control_load,
        r.semester,
        r.removed_at,
        ts.id_profile_template
      FROM rpd_1c_exchange r
      LEFT JOIN template_status ts ON ts.id_1c_template = r.id
      WHERE r.id_rpd_complect = $1
        AND NULLIF(TRIM(r.discipline), '') IS NOT NULL
    `,
    [complectId]
  );

  return rows.map(normalizeLocalRow);
};

const incomingFrom1cList = (disciplines: unknown[]) =>
  disciplines
    .map((disc) => {
      const normalized = normalizeDisciplineFrom1c(disc);
      if (!normalized.discipline) return null;
      return normalized as IncomingRow;
    })
    .filter((row): row is IncomingRow => row !== null);

const diffFields = (localRow: Record<string, unknown>, incomingRow: Record<string, unknown>) => {
  const changes: FieldChange[] = [];
  for (const field of SYNC_FIELDS) {
    const oldValue = localRow[field];
    const newValue = incomingRow[field];
    if (!valuesEqual(oldValue, newValue)) {
      changes.push({ field, old: oldValue, new: newValue });
    }
  }
  return changes;
};

const diffDisciplines = (localRows: LocalRow[], incomingRows: IncomingRow[]) => {
  const activeLocal = localRows.filter((row) => !row.removed_at);
  const localByKey = new Map(activeLocal.map((row) => [matchDisciplineKey(row), row]));
  const incomingByKey = new Map(
    incomingRows.map((row) => [matchDisciplineKey(row), row])
  );

  const result: DiffResult = {
    new: [],
    updated: [],
    removed: [],
    unchanged: [],
  };

  for (const [key, incoming] of incomingByKey) {
    const local = localByKey.get(key);
    if (!local) {
      result.new.push({
        key,
        incoming,
        fields: SYNC_FIELDS.map((field) => ({
          field,
          old: null,
          new: incoming[field],
        })),
      });
      continue;
    }

    const fields = diffFields(local, incoming);
    if (fields.length) {
      result.updated.push({
        id_1c: local.id,
        key,
        local,
        incoming,
        fields,
        hasProfileTemplate: Boolean(local.id_profile_template),
      });
    } else {
      result.unchanged.push({
        id_1c: local.id,
        key,
        local,
        incoming,
        hasProfileTemplate: Boolean(local.id_profile_template),
      });
    }
  }

  for (const [key, local] of localByKey) {
    if (!incomingByKey.has(key)) {
      result.removed.push({
        id_1c: local.id,
        key,
        local,
        hasProfileTemplate: Boolean(local.id_profile_template),
      });
    }
  }

  return result;
};

const preview1cSync = async (complectId: unknown) => {
  const { rows: complectRows } = await pool.query<RpdComplectRow & Record<string, unknown>>(
    `
      SELECT *
      FROM rpd_complects
      WHERE id::text = $1::text OR uuid::text = $1::text
      LIMIT 1
    `,
    [String(complectId)]
  );
  const complectMeta = complectRows[0];
  if (!complectMeta) {
    const error = new Error("Комплект не найден") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const incomingRaw = await fetchUpLink(buildComplectApiData(complectMeta));
  const incoming = incomingFrom1cList(incomingRaw);
  const local = await loadLocalDisciplines(complectMeta.id);
  const diff = diffDisciplines(local, incoming);

  return {
    complect: {
      id: complectMeta.id,
      uuid: complectMeta.uuid,
      faculty: complectMeta.faculty,
      year: complectMeta.year,
      education_form: complectMeta.education_form,
      education_level: complectMeta.education_level,
      profile: complectMeta.profile,
      direction: complectMeta.direction,
      last_synced_at: complectMeta.last_synced_at,
      has_pending_changes: complectMeta.has_pending_changes,
    },
    diff,
  };
};

const insertStatusHistory = async (client: PoolClient, templateId: number) => {
  const { rows: existing } = await client.query<{ id: number }>(
    `
      SELECT id
      FROM template_status
      WHERE id_1c_template = $1
      LIMIT 1
    `,
    [templateId]
  );

  if (existing.length) return;

  const history = [
    {
      date: moment().format(),
      status: "unloaded",
      user: "Система",
    },
  ];

  await client.query(
    `
      INSERT INTO template_status (id_1c_template, history)
      VALUES ($1, $2)
    `,
    [templateId, JSON.stringify(history)]
  );
};

const recordFieldChange = async (
  client: PoolClient,
  {
    syncLogId,
    id1c,
    idProfileTemplate,
    fieldKey,
    oldValue,
    newValue,
  }: FieldChangeInput
) => {
  await client.query(
    `
      INSERT INTO template_field_changes (
        sync_log_id,
        id_1c_exchange,
        id_profile_template,
        field_key,
        old_value,
        new_value
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      syncLogId,
      id1c,
      idProfileTemplate,
      fieldKey,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
    ]
  );
};

const syncTemplateFields = async (
  client: PoolClient,
  {
    syncLogId,
    id1c,
    idProfileTemplate,
    localRow,
    incomingRow,
    fieldsToApply,
  }: { syncLogId: number; id1c: number; idProfileTemplate: number | null; localRow: LocalRow; incomingRow: IncomingRow; fieldsToApply: string[] }
) => {
  if (!idProfileTemplate || !fieldsToApply.length) return;

  const updates = [];
  const values = [];
  let paramIndex = 1;

  for (const field of fieldsToApply) {
    if (!TEMPLATE_SYNC_FIELDS.has(field)) continue;
    const templateField = TEMPLATE_FIELD_MAP[field];
    const newValue = incomingRow[field];
    const oldValue = localRow[field];
    updates.push(`${templateField} = $${paramIndex}`);
    values.push(
      field === "study_load" || field === "control_load"
        ? JSON.stringify(newValue ?? {})
        : newValue
    );
    paramIndex += 1;

    await recordFieldChange(client, {
      syncLogId,
      id1c,
      idProfileTemplate,
      fieldKey: field,
      oldValue,
      newValue,
    });
  }

  if (fieldsToApply.includes("control_load")) {
    const certification = deriveCertification(incomingRow.control_load);
    if (certification) {
      updates.push(`certification = $${paramIndex}`);
      values.push(certification);
      paramIndex += 1;
      await recordFieldChange(client, {
        syncLogId,
        id1c,
        idProfileTemplate,
        fieldKey: "certification",
        oldValue: null,
        newValue: certification,
      });
    }
  }

  if (!updates.length) return;

  values.push(idProfileTemplate);
  await client.query(
    `
      UPDATE rpd_profile_templates
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
    `,
    values
  );
};

const applySync = async ({ complectId, selections, userId }: { complectId: unknown; selections?: unknown; userId?: number }) => {
  const { rows: complectRows } = await pool.query<{ id: number }>(
    `
      SELECT id
      FROM rpd_complects
      WHERE id::text = $1::text OR uuid::text = $1::text
      LIMIT 1
    `,
    [String(complectId)]
  );
  const numericComplectId = complectRows[0]?.id;
  if (!numericComplectId) {
    const error = new Error("Комплект не найден") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: syncLogRows } = await client.query<{ id: number }>(
      `
        INSERT INTO complect_sync_log (complect_id, user_id, source)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [numericComplectId, userId ?? null, "1c"]
    );
    const syncLogId = syncLogRows[0].id;

    const localRows = await loadLocalDisciplines(numericComplectId);
    const localById = new Map(localRows.map((row) => [row.id, row]));

    for (const selection of (selections || []) as Selection[]) {
      const action = selection.action;
      const fields =
        Array.isArray(selection.fields) && selection.fields.length
          ? selection.fields
          : SYNC_FIELDS;

      if (action === "add") {
        const incoming = selection.incoming;
        if (!incoming?.discipline) continue;

        const { rows: inserted } = await client.query<{ id: number }>(
          `
            INSERT INTO rpd_1c_exchange (
              id_rpd_complect,
              department,
              discipline,
              teachers,
              zet,
              place,
              study_load,
              control_load,
              semester,
              record_type,
              removed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)
            ON CONFLICT (
              id_rpd_complect,
              discipline,
              COALESCE(semester, -1),
              COALESCE(record_type, '')
            )
            DO UPDATE SET
              department = EXCLUDED.department,
              teachers = EXCLUDED.teachers,
              zet = EXCLUDED.zet,
              place = EXCLUDED.place,
              study_load = EXCLUDED.study_load,
              control_load = EXCLUDED.control_load,
              semester = EXCLUDED.semester,
              removed_at = NULL
            RETURNING id
          `,
          [
            numericComplectId,
            incoming.department,
            incoming.discipline,
            incoming.teachers,
            incoming.zet,
            incoming.place,
            JSON.stringify(incoming.study_load ?? {}),
            JSON.stringify(incoming.control_load ?? {}),
            incoming.semester,
            incoming.record_type ?? "",
          ]
        );

        const id1c = inserted[0].id;
        await insertStatusHistory(client, id1c);
        await recordFieldChange(client, {
          syncLogId,
          id1c,
          idProfileTemplate: null,
          fieldKey: NEW_DISCIPLINE_MARKER,
          oldValue: null,
          newValue: { discipline: incoming.discipline },
        });
        continue;
      }

      if (action === "remove") {
        const id1c = selection.id_1c;
        if (!id1c) continue;
        await client.query(
          `
            UPDATE rpd_1c_exchange
            SET removed_at = NOW()
            WHERE id = $1 AND id_rpd_complect = $2
          `,
          [id1c, numericComplectId]
        );
        const local = localById.get(id1c!);
        await recordFieldChange(client, {
          syncLogId,
          id1c,
          idProfileTemplate: local?.id_profile_template ?? null,
          fieldKey: "removed",
          oldValue: { discipline: local?.discipline },
          newValue: null,
        });
        continue;
      }

      if (action === "update") {
        const id1c = selection.id_1c;
        const incoming = selection.incoming;
        const local = localById.get(id1c!);
        if (!id1c || !incoming || !local) continue;

        const exchangeUpdates = [];
        const exchangeValues = [];
        let idx = 1;

        for (const field of fields) {
          if (!SYNC_FIELDS.includes(field)) continue;
          if (field === "discipline") {
            exchangeUpdates.push(`discipline = $${idx}`);
            exchangeValues.push(incoming.discipline);
          } else if (field === "department") {
            exchangeUpdates.push(`department = $${idx}`);
            exchangeValues.push(incoming.department);
          } else if (field === "semester") {
            exchangeUpdates.push(`semester = $${idx}`);
            exchangeValues.push(incoming.semester);
          } else if (field === "zet") {
            exchangeUpdates.push(`zet = $${idx}`);
            exchangeValues.push(incoming.zet);
          } else if (field === "place") {
            exchangeUpdates.push(`place = $${idx}`);
            exchangeValues.push(incoming.place);
          } else if (field === "teachers") {
            exchangeUpdates.push(`teachers = $${idx}`);
            exchangeValues.push(incoming.teachers);
          } else if (field === "study_load") {
            exchangeUpdates.push(`study_load = $${idx}`);
            exchangeValues.push(JSON.stringify(incoming.study_load ?? {}));
          } else if (field === "control_load") {
            exchangeUpdates.push(`control_load = $${idx}`);
            exchangeValues.push(JSON.stringify(incoming.control_load ?? {}));
          }
          idx += 1;
        }

        if (exchangeUpdates.length) {
          exchangeUpdates.push("removed_at = NULL");
          exchangeValues.push(id1c, numericComplectId);
          await client.query(
            `
              UPDATE rpd_1c_exchange
              SET ${exchangeUpdates.join(", ")}
              WHERE id = $${idx} AND id_rpd_complect = $${idx + 1}
            `,
            exchangeValues
          );
        }

        const templateFields = fields.filter((f) => TEMPLATE_SYNC_FIELDS.has(f));
        await syncTemplateFields(client, {
          syncLogId,
          id1c,
          idProfileTemplate: local.id_profile_template,
          localRow: local,
          incomingRow: incoming,
          fieldsToApply: templateFields,
        });

        for (const field of fields.filter(
          (f) => !TEMPLATE_SYNC_FIELDS.has(f) && f !== "teachers"
        )) {
          await recordFieldChange(client, {
            syncLogId,
            id1c,
            idProfileTemplate: local.id_profile_template,
            fieldKey: field,
            oldValue: local[field],
            newValue: incoming[field],
          });
        }

        if (fields.includes("teachers")) {
          await recordFieldChange(client, {
            syncLogId,
            id1c,
            idProfileTemplate: null,
            fieldKey: "teachers",
            oldValue: local.teachers,
            newValue: incoming.teachers,
          });
        }
      }
    }

    await client.query(
      `
        UPDATE rpd_complects
        SET last_synced_at = NOW(),
            has_pending_changes = true
        WHERE id = $1
      `,
      [numericComplectId]
    );

    await client.query("COMMIT");
    return { complectId: numericComplectId, syncLogId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getUnacknowledgedFieldChanges = async (profileTemplateId: unknown) => {
  const { rows } = await pool.query<{ field_key: string; old_value: unknown | null; new_value: unknown | null; id: number }>(
    `
      SELECT field_key, old_value, new_value, id
      FROM template_field_changes
      WHERE id_profile_template = $1
        AND acknowledged_at IS NULL
        AND field_key NOT IN ($2, 'removed', 'teachers')
      ORDER BY applied_at ASC
    `,
    [profileTemplateId, NEW_DISCIPLINE_MARKER]
  );

  return rows.map((row) => ({
    id: row.id,
    field_key: row.field_key,
    old_value: row.old_value,
    new_value: row.new_value,
  }));
};

const acknowledgeFieldChanges = async (profileTemplateId: unknown, changeIds: unknown) => {
  const numericId = Number(profileTemplateId);
  if (!Number.isFinite(numericId)) {
    const error = new Error("Некорректный идентификатор шаблона") as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  if (Array.isArray(changeIds) && changeIds.length) {
    await pool.query(
      `
        UPDATE template_field_changes
        SET acknowledged_at = NOW()
        WHERE id_profile_template = $1
          AND id = ANY($2::int[])
          AND acknowledged_at IS NULL
      `,
      [numericId, changeIds]
    );
  } else {
    await pool.query(
      `
        UPDATE template_field_changes
        SET acknowledged_at = NOW()
        WHERE id_profile_template = $1
          AND acknowledged_at IS NULL
      `,
      [numericId]
    );
  }

  const { rows } = await pool.query<{ remaining: number }>(
    `
      SELECT COUNT(*)::int AS remaining
      FROM template_field_changes
      WHERE id_profile_template = $1
        AND acknowledged_at IS NULL
    `,
    [numericId]
  );

  if (rows[0]?.remaining === 0) {
    await pool.query(
      `
        UPDATE rpd_complects rc
        SET has_pending_changes = EXISTS (
          SELECT 1
          FROM rpd_1c_exchange e
          JOIN template_field_changes tfc ON tfc.id_1c_exchange = e.id
          WHERE e.id_rpd_complect = rc.id
            AND tfc.acknowledged_at IS NULL
        )
        WHERE rc.id = (
          SELECT id_rpd_complect
          FROM rpd_profile_templates
          WHERE id = $1
        )
      `,
      [numericId]
    );
  }

  return { acknowledged: true };
};

export {
  SYNC_FIELDS,
  TEMPLATE_SYNC_FIELDS,
  NEW_DISCIPLINE_MARKER,
  buildComplectApiData,
  matchDisciplineKey,
  diffFields,
  diffDisciplines,
  preview1cSync,
  applySync,
  getUnacknowledgedFieldChanges,
  acknowledgeFieldChanges,
  deriveCertification,
};
