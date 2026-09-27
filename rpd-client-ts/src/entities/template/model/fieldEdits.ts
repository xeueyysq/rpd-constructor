export type FieldEdit = {
  userId: number | null;
  fullname: string;
  at: string;
};

export type FieldEdits = Record<string, FieldEdit>;

export type UpdateTemplateFieldResponse = {
  field: string;
  value: unknown;
  edit: FieldEdit;
};

export type TemplatePresenceResponse = {
  editors: { userId: number; fullname: string }[];
  fieldEdits: FieldEdits;
};
