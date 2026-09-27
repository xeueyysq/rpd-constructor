import type { Pool, PoolClient } from "pg";
import { formatShortName } from "./teacherNames.ts";

export type StoredFieldEdit = { userId: number | null; at: string };
export type FieldEdit = StoredFieldEdit & { fullname: string };
export type StoredFieldEdits = Record<string, StoredFieldEdit>;

const EDIT_AT = `to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export function fieldEditsSet(userParam: number, fieldsParam: number): string {
  return `field_edits = field_edits || COALESCE((SELECT jsonb_object_agg(f, jsonb_build_object('userId', $${userParam}::int, 'at', ${EDIT_AT})) FROM unnest($${fieldsParam}::text[]) f), '{}'::jsonb)`;
}

export async function withEditorNamesAndUsers(db: Pool | PoolClient, fieldEdits: StoredFieldEdits | null, extraIds: number[] = []) {
  const edits = fieldEdits ?? {};
  const ids = [...new Set([...Object.values(edits).map((edit) => edit.userId).filter((id): id is number => id !== null), ...extraIds])];
  const { rows } = ids.length
    ? await db.query<{ id: number; fullname: unknown }>("SELECT id, fullname FROM users WHERE id = ANY($1::int[])", [ids])
    : { rows: [] };
  const names = new Map(rows.map((row) => [row.id, formatShortName(row.fullname)]));
  return {
    edits: Object.fromEntries(Object.entries(edits).map(([field, edit]) => [field, { ...edit, fullname: edit.userId === null ? "1С" : names.get(edit.userId) ?? "" }])) as Record<string, FieldEdit>,
    names,
  };
}

export async function withEditorNames(db: Pool | PoolClient, fieldEdits: StoredFieldEdits | null): Promise<Record<string, FieldEdit>> {
  return (await withEditorNamesAndUsers(db, fieldEdits)).edits;
}
