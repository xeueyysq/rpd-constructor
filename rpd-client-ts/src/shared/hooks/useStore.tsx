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

export interface SelectTeacherParams {
  id: number;
  teacher: string;
  userName: string | undefined;
}

interface CreateByCriteria {
  faculty?: string | undefined;
  year?: string | undefined;
}

interface TabState {
  isEnabled: boolean;
}

interface TeacherTemplate {
  id: number | undefined;
  text: string | undefined;
  year: number | undefined;
}

export type PlannedResultsFilters = {
  profile: string;
  formEducation: string;
  year: number | null;
};

interface StoreState {
  jsonData: JsonData;
  selectedTemplateData: SelectedTemplateData;
  createByCriteria: CreateByCriteria;
  complectId: number | undefined;
  plannedResultsFilters: PlannedResultsFilters;
  tabs: Record<string, TabState>;
  managerPage: string;
  templatePage: string;
  teacherTemplates: TeacherTemplate[];
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
  setCreateByCriteria: (
    faculty?: string | undefined,
    year?: string | undefined
  ) => void;
  setComplectId: (id: number) => void;
  setPlannedResultsFilters: (filters: PlannedResultsFilters) => void;
  setTabState: (tabId: string, isEnabled: boolean) => void;
  deInitializeTabs: () => void;
  setManagerPage: (page: string) => void;
  setTemplatePage: (templatePage: string) => void;
  setTeacherTemplates: (templates: TeacherTemplate[]) => void;
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
    createByCriteria: {
      faculty: undefined,
      year: undefined,
    },
    tabs: {
      selectData: { isEnabled: true },
      workingType: { isEnabled: false },
      createTemplateFromExchange: { isEnabled: false },
      changeTemplate: { isEnabled: false },
    },
    managerPage: "selectData",
    complectId: undefined,
    plannedResultsFilters: {
      profile: "",
      formEducation: "",
      year: null,
    },
    templatePage: "coverPage",
    teacherTemplates: [],
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
    setCreateByCriteria: (faculty, year) => {
      set((state) => {
        if (faculty) state.createByCriteria.faculty = faculty;
        if (year) state.createByCriteria.year = year;
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
    setTabState: (tabId, isEnabled) => {
      set((state) => {
        if (state.tabs[tabId]) {
          state.tabs[tabId].isEnabled = isEnabled;
        }
      });
    },
    deInitializeTabs: () => {
      set((state) => {
        state.tabs.workingType.isEnabled = false;
        state.tabs.createTemplateFromExchange.isEnabled = false;
        state.tabs.changeTemplate.isEnabled = false;
      });
    },
    setManagerPage: (page) => {
      set((state) => {
        state.managerPage = page;
      });
    },
    setTemplatePage: (templatePage) => {
      set((state) => {
        state.templatePage = templatePage;
      });
    },
    setTeacherTemplates: (templates) => {
      set((state) => {
        state.teacherTemplates = templates;
      });
    },
    toggleDrawer: () => {
      set((state) => {
        state.isDrawerOpen = !state.isDrawerOpen;
      });
    },
  }))
);
