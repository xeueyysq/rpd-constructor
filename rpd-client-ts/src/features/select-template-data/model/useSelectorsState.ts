import { useEffect, useState } from "react";
import { useStore } from "@shared/hooks";
import { OptionType } from "./SelectorTypes";

type Nullable<T> = T | undefined;

export interface SelectorsState {
  faculty: Nullable<OptionType>;
  levelEducation: Nullable<OptionType>;
  directionOfStudy: Nullable<OptionType>;
  profile: Nullable<OptionType>;
  formEducation: Nullable<OptionType>;
  year: Nullable<OptionType>;
}

const toOption = (value: string | undefined): Nullable<OptionType> =>
  value ? { value, label: value } : undefined;

const buildInitialState = (): SelectorsState => {
  const selectorsData = useStore.getState().selectedTemplateData;

  return {
    faculty: toOption(selectorsData.faculty),
    levelEducation: toOption(selectorsData.levelEducation),
    directionOfStudy: toOption(selectorsData.directionOfStudy),
    profile: toOption(selectorsData.profile),
    formEducation: toOption(selectorsData.formEducation),
    year: toOption(selectorsData.year),
  };
};

export const useSelectorsState = () => {
  const { setSelectedTemplateData, setTabState, deInitializeTabs } = useStore();
  const [selectors, setSelectors] = useState(buildInitialState);
  const [isFacultyOpen, setIsFacultyOpen] = useState(
    () => !buildInitialState().faculty
  );

  useEffect(() => {
    setIsFacultyOpen(!selectors.faculty);
  }, [selectors.faculty]);

  const handleChange =
    (name: keyof SelectorsState) =>
    (
      _: React.SyntheticEvent<Element, Event>,
      selectedOption: OptionType | null
    ) => {
      setSelectors((prevSelectors) => ({
        ...prevSelectors,
        [name]: selectedOption || undefined,
        ...(name === "faculty" && {
          levelEducation: undefined,
          directionOfStudy: undefined,
          profile: undefined,
          formEducation: undefined,
          year: undefined,
        }),
        ...(name === "levelEducation" && {
          directionOfStudy: undefined,
          profile: undefined,
          formEducation: undefined,
          year: undefined,
        }),
        ...(name === "directionOfStudy" && {
          profile: undefined,
          formEducation: undefined,
          year: undefined,
        }),
        ...(name === "profile" && {
          formEducation: undefined,
          year: undefined,
        }),
        ...(name === "formEducation" && { year: undefined }),
      }));

      if (name === "faculty" && selectedOption) {
        setIsFacultyOpen(false);
      }
    };

  const saveTemplateData = (setChoise?: (value: string) => void) => {
    setSelectedTemplateData(
      selectors.faculty?.value,
      selectors.levelEducation?.value,
      selectors.directionOfStudy?.value,
      selectors.profile?.value,
      selectors.formEducation?.value,
      selectors.year?.value
    );
    setChoise?.("workingType");
    deInitializeTabs();
    setTabState("workingType", true);
  };

  return {
    selectors,
    isFacultyOpen,
    setIsFacultyOpen,
    handleChange,
    saveTemplateData,
  };
};
