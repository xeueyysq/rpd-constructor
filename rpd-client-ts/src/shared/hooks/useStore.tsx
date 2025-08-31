import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

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

interface StoreState {
  jsonData: JsonData;
  selectedTemplateData: SelectedTemplateData;
  createByCriteria: CreateByCriteria;
  complectId: number | undefined;
  tabs: Record<string, TabState>;
  managerPage: string;
  templatePage: string;
  teacherTemplates: TeacherTemplate[];
  setJsonData: (data: JsonData) => void;
  updateJsonData: (key: string, value: JsonValue) => void;
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
  setTabState: (tabId: string, isEnabled: boolean) => void;
  deInitializeTabs: () => void;
  setManagerPage: (page: string) => void;
  setTemplatePage: (templatePage: string) => void;
  setTeacherTemplates: (templates: TeacherTemplate[]) => void;
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
    templatePage: "coverPage",
    teacherTemplates: {
      id: undefined,
      text: undefined,
      year: undefined,
    },
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
  }))
);
