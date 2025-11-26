import { FC, useEffect, useState } from "react";
import { CustomSelector as Selector } from "./Selector.tsx";
import { Loader } from "@shared/ui";
import { Box, Button, Autocomplete, TextField } from "@mui/material";
import { useStore } from "@shared/hooks";
import { OptionType } from "../model/SelectorTypes.ts";
import { enqueueSnackbar, VariantType } from "notistack";
// import { TemplateConstructorType } from '@entities/template/index.ts'

interface JsonData {
  [key: string]: string | JsonData;
}

type Nullable<T> = T | undefined;

interface SelectorsState {
  faculty: Nullable<OptionType>;
  levelEducation: Nullable<OptionType>;
  directionOfStudy: Nullable<OptionType>;
  profile: Nullable<OptionType>;
  formEducation: Nullable<OptionType>;
  year: Nullable<OptionType>;
}

interface Selectors {
  setChoise?: (value: string) => void;
}

export const Selectors: FC<Selectors> = ({ setChoise }) => {
  const { setTabState } = useStore();
  const { deInitializeTabs } = useStore();
  const selectorsData = useStore.getState().selectedTemplateData;
  const [isFacultyOpen, setIsFacultyOpen] = useState(!selectorsData.faculty);
  const [selectors, setSelectors] = useState<SelectorsState>({
    faculty: selectorsData.faculty ? { value: selectorsData.faculty, label: selectorsData.faculty } : undefined,
    levelEducation: selectorsData.levelEducation
      ? {
          value: selectorsData.levelEducation,
          label: selectorsData.levelEducation,
        }
      : undefined,
    directionOfStudy: selectorsData.directionOfStudy
      ? {
          value: selectorsData.directionOfStudy,
          label: selectorsData.directionOfStudy,
        }
      : undefined,
    profile: selectorsData.profile ? { value: selectorsData.profile, label: selectorsData.profile } : undefined,
    formEducation: selectorsData.formEducation
      ? {
          value: selectorsData.formEducation,
          label: selectorsData.formEducation,
        }
      : undefined,
    year: selectorsData.year ? { value: selectorsData.year, label: selectorsData.year } : undefined,
  });

  const [data, setData] = useState<Nullable<JsonData>>(undefined);
  const { setSelectedTemplateData } = useStore();

  useEffect(() => {
    setIsFacultyOpen(!selectors.faculty);
  }, [selectors.faculty]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/json_profiles.json", {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        const jsonData: JsonData = await response.json();
        setData(jsonData);
      } catch (error) {
        const variant: VariantType = "error";
        enqueueSnackbar("Ошибка загрузки профилей", { variant });
      }
    };

    fetchData();
  }, []);

  const handleChange =
    (name: keyof SelectorsState) => (_: React.SyntheticEvent<Element, Event>, selectedOption: OptionType | null) => {
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

  const getOptions = (): OptionType[] => {
    return data ? Object.keys(data).map((key) => ({ label: key, value: key })) : [];
  };

  const getOptionsForSelector = (selectorPath: Array<string>, indicator?: string): OptionType[] => {
    if (indicator && indicator === "lastChild") {
      const currentYear = new Date().getFullYear();
      const yearsCount = 5;
      return Array.from({ length: yearsCount }, (_, i) => {
        const year = currentYear + 1 - i;
        return { label: String(year), value: String(year) };
      });
    }
    if (!data) return [];
    let currentData = data;

    for (const key of selectorPath) {
      currentData = currentData[key] as JsonData;
      if (!currentData) {
        return [];
      }
    }
    return Object.keys(currentData).map((key) => ({
      label: key,
      value: key,
    }));
  };

  const saveTemplateData = () => {
    setSelectedTemplateData(
      selectors.faculty?.value,
      selectors.levelEducation?.value,
      selectors.directionOfStudy?.value,
      selectors.profile?.value,
      selectors.formEducation?.value,
      selectors.year?.value
    );
    setChoise("workingType");
    deInitializeTabs();
    setTabState("workingType", true);
  };

  // const selectedValue = useMemo(
  //     () => all
  // )

  if (!data) return <Loader />;

  return (
    <Box sx={{ maxWidth: "700px", py: 2 }}>
      <Box sx={{ fontSize: "15px", fontWeight: "600", py: 1 }}>Институт</Box>
      <Autocomplete
        // placeholder="Выберите институт"
        // isClearable
        value={selectors.faculty}
        onChange={handleChange("faculty")}
        options={getOptions()}
        data-cy="faculty-select"
        open={isFacultyOpen}
        onOpen={() => setIsFacultyOpen(true)}
        onClose={() => setIsFacultyOpen(false)}
        renderInput={(params) => <TextField {...params} label="Выберите институт" size="small" data-cy="text-field" />}
      />
      {selectors.faculty && (
        <Selector
          title="Уровень образования"
          placeholder="Выберите уровень образования"
          value={selectors.levelEducation}
          onChange={handleChange("levelEducation")}
          options={getOptionsForSelector([selectors.faculty.value])}
          data-cy="education-level-select"
        />
      )}
      {selectors.faculty && selectors.levelEducation && (
        <Selector
          title="Направление обучения"
          placeholder="Выберите направление обучения"
          value={selectors.directionOfStudy}
          onChange={handleChange("directionOfStudy")}
          options={getOptionsForSelector([selectors.faculty.value, selectors.levelEducation.value])}
          data-cy="direction-select"
        />
      )}
      {selectors.faculty && selectors.levelEducation && selectors.directionOfStudy && (
        <Selector
          title="Профиль направления обучения"
          placeholder="Выберите профиль обучения"
          value={selectors.profile}
          onChange={handleChange("profile")}
          options={getOptionsForSelector([
            selectors.faculty.value,
            selectors.levelEducation.value,
            selectors.directionOfStudy.value,
          ])}
          data-cy="profile-select"
        />
      )}
      {selectors.faculty && selectors.levelEducation && selectors.directionOfStudy && selectors.profile && (
        <Selector
          title="Форма обучения"
          placeholder="Выберите форму обучения"
          value={selectors.formEducation}
          onChange={handleChange("formEducation")}
          options={getOptionsForSelector([
            selectors.faculty.value,
            selectors.levelEducation.value,
            selectors.directionOfStudy.value,
            selectors.profile.value,
          ])}
          data-cy="education-form-select"
        />
      )}
      {selectors.faculty &&
        selectors.levelEducation &&
        selectors.directionOfStudy &&
        selectors.profile &&
        selectors.formEducation && (
          <Selector
            title="Год набора"
            placeholder="Выберите год набора"
            value={selectors.year}
            onChange={handleChange("year")}
            options={getOptionsForSelector(
              [
                selectors.faculty.value,
                selectors.levelEducation.value,
                selectors.directionOfStudy.value,
                selectors.profile.value,
                selectors.formEducation.value,
              ],
              "lastChild"
            )}
            data-cy="year-select"
          />
        )}
      {selectors.year && (
        <Button sx={{ my: 1 }} variant="contained" onClick={saveTemplateData}>
          Продолжить
        </Button>
      )}
    </Box>
  );
};
