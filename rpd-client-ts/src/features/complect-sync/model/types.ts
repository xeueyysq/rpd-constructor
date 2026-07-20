export type SyncDisciplineIncoming = {
  department: string;
  discipline: string;
  teachers: string[];
  zet: number | null;
  place: string;
  record_type: string;
  study_load: Record<string, unknown>;
  control_load: Record<string, unknown>;
  semester: number | null;
};

export type SyncFieldChange = {
  field: string;
  old: unknown;
  new: unknown;
};

export type SyncDiffNewItem = {
  key: string;
  incoming: SyncDisciplineIncoming;
  fields: SyncFieldChange[];
};

export type SyncDiffUpdatedItem = {
  id_1c: number;
  key: string;
  local: SyncDisciplineIncoming & { id?: number };
  incoming: SyncDisciplineIncoming;
  fields: SyncFieldChange[];
  hasProfileTemplate: boolean;
};

export type SyncDiffRemovedItem = {
  id_1c: number;
  key: string;
  local: SyncDisciplineIncoming & { id?: number };
  hasProfileTemplate: boolean;
};

export type SyncDiff = {
  new: SyncDiffNewItem[];
  updated: SyncDiffUpdatedItem[];
  removed: SyncDiffRemovedItem[];
  unchanged: Array<{
    id_1c: number;
    key: string;
    hasProfileTemplate: boolean;
  }>;
};

export type SyncPreviewResponse = {
  complect: {
    id: number;
    uuid?: string;
    last_synced_at?: string | null;
    has_pending_changes?: boolean;
  };
  diff: SyncDiff;
};

export type SyncApplySelection = {
  action: "add" | "update" | "remove";
  id_1c?: number;
  fields?: string[];
  incoming?: SyncDisciplineIncoming;
};
