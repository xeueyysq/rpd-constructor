import type { FieldEdit, FieldEdits } from "../model/fieldEdits";

export function latestEdit(
  edits: FieldEdits,
  fields?: string[]
): FieldEdit | undefined {
  const selected = fields
    ? fields.map((field) => edits[field])
    : Object.values(edits);
  return selected.reduce<FieldEdit | undefined>(
    (latest, edit) =>
      edit && (!latest || edit.at > latest.at) ? edit : latest,
    undefined
  );
}

export function formatEdit(edit: FieldEdit): string {
  const date = new Date(edit.at);
  return `${edit.fullname}, ${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

export function changedCleanFields(
  local: FieldEdits,
  remote: FieldEdits,
  dirty: Record<string, number>
): string[] {
  return Object.keys(remote).filter(
    (field) => !dirty[field] && remote[field].at !== local[field]?.at
  );
}
