import { create } from "zustand";

type TemplateSync = {
  dirty: Record<string, number>;
  pending: number;
  savedAt: string | null;
  markDirty: (field: string) => number;
  clearDirty: (field: string, revision?: number) => void;
  reset: () => void;
  track: <T>(promise: Promise<T>) => Promise<T>;
};

let generation = 0;
let revision = 0;

export const useTemplateSync = create<TemplateSync>((set) => ({
  dirty: {},
  pending: 0,
  savedAt: null,
  markDirty: (field) => {
    const next = ++revision;
    set((state) => ({ dirty: { ...state.dirty, [field]: next } }));
    return next;
  },
  clearDirty: (field, expectedRevision) =>
    set((state) => {
      if (
        state.dirty[field] === undefined ||
        (expectedRevision !== undefined &&
          state.dirty[field] !== expectedRevision)
      )
        return state;
      const dirty = { ...state.dirty };
      delete dirty[field];
      return { dirty };
    }),
  reset: () => {
    generation += 1;
    set({ dirty: {}, pending: 0, savedAt: null });
  },
  track: async <T>(promise: Promise<T>): Promise<T> => {
    const startedIn = generation;
    set((state) => ({ pending: state.pending + 1 }));
    try {
      const result = await promise;
      if (generation === startedIn) set({ savedAt: new Date().toISOString() });
      return result;
    } finally {
      if (generation === startedIn) {
        set((state) => ({ pending: Math.max(0, state.pending - 1) }));
      }
    }
  },
}));
