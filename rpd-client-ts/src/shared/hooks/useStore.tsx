import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

interface JsonData {
  [key: string]: JsonValue;
}

export interface SelectedTemplateData {
  faculty: string | undefined;
  levelEducation: string | undefined;
  directionOfStudy: string | undefined;
  profile: string | undefined;
  formEducation: string | undefined;
  year: string | undefined;
}

export type PlannedResultsFilters = {
  profile: string;
  formEducation: string;
  year: number | null;
};

interface StoreState {
  jsonData: JsonData;
  selectedTemplateData: SelectedTemplateData;
  complectId: number | undefined;
  plannedResultsFilters: PlannedResultsFilters;
  managerPage: string;
  isDrawerOpen: boolean;
  setJsonData: (data: JsonData) => void;
  updateJsonData: (key: string, value: JsonValue) => void;
  updateJsonComment: (field: string, value: JsonValue) => void;
  setSelectedTemplateData: (
    faculty: string | undefined,
    levelEducation: string | undefined,
    directionOfStudy: string | undefined,
    profile: string | undefined,
    formEducation: string | undefined,
    year: string | undefined
  ) => void;
  setComplectId: (id: number) => void;
  setPlannedResultsFilters: (filters: PlannedResultsFilters) => void;
  setManagerPage: (page: string) => void;
  toggleDrawer: () => void;
}

export const useStore = create<StoreState>()(
  immer((set) => ({
    openedTemplateId: undefined,
    jsonData: {},
    selectedTemplateData: {
      faculty: undefined,
      levelEducation: undefined,
      directionOfStudy: undefined,
      profile: undefined,
      formEducation: undefined,
      year: undefined,
    },
    managerPage: "selectData",
    complectId: undefined,
    plannedResultsFilters: {
      profile: "",
      formEducation: "",
      year: null,
    },
    isDrawerOpen: true,
    setJsonData: (data) => {
      set((state) => {
        state.jsonData = data;
      });
    },
    updateJsonData: (key, value) => {
      set((state) => {
        if (value !== undefined) {
          state.jsonData[key] = value;
        } else {
          delete state.jsonData[key];
        }
      });
    },
    updateJsonComment: (key, value) => {
      set((state) => {
        if (!state.jsonData.comments) {
          state.jsonData.comments = {};
        }
        if (value === undefined || value === null) {
          delete state.jsonData.comments[key];
          return;
        }

        // Backward-compat: sometimes comment html came back quoted as a JSON string.
        // Treat this value as invalid/empty (it used to appear when comment_text was JSON.stringify'ed).
        if (value === '"<p>undefined</p>"') {
          delete state.jsonData.comments[key];
          return;
        }

        if (typeof value === "object") {
          state.jsonData.comments[key] = value;
          return;
        }

        // value is string/primitive -> store as comment_text
        const existing = state.jsonData.comments[key];
        if (existing && typeof existing === "object") {
          existing.comment_text = value;
        } else {
          state.jsonData.comments[key] = { comment_text: value };
        }
      });
    },
    setSelectedTemplateData: (
      faculty,
      levelEducation,
      directionOfStudy,
      profile,
      formEducation,
      year
    ) => {
      set((state) => {
        if (
          faculty &&
          levelEducation &&
          directionOfStudy &&
          profile &&
          formEducation &&
          year
        ) {
          state.selectedTemplateData = {
            faculty: faculty,
            levelEducation: levelEducation,
            directionOfStudy: directionOfStudy,
            profile: profile,
            formEducation: formEducation,
            year: year,
          };
        }
      });
    },
    setComplectId: (id) => {
      set((state) => {
        state.complectId = id;
      });
    },
    setPlannedResultsFilters: (filters) => {
      set((state) => {
        state.plannedResultsFilters = filters;
      });
    },
    setManagerPage: (page) => {
      set((state) => {
        state.managerPage = page;
      });
    },
    toggleDrawer: () => {
      set((state) => {
        state.isDrawerOpen = !state.isDrawerOpen;
      });
    },
  }))
);
