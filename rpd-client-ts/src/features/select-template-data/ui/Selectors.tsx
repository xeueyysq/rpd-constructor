import { FC } from "react";
import { CustomSelector as Selector } from "./Selector.tsx";
import { Loader } from "@shared/ui";
import { Box, Button, Autocomplete, TextField } from "@mui/material";
import { getFacultyOptions, getNestedOptions } from "../model/profileTreeUtils";
import { useSelectorsState } from "../model/useSelectorsState";
import { useSpecProfiles } from "../model/useSpecProfiles";

interface Selectors {
  setChoise?: (value: string) => void;
}

export const Selectors: FC<Selectors> = ({ setChoise }) => {
  const { tree, isLoading } = useSpecProfiles();
  const {
    selectors,
    isFacultyOpen,
    setIsFacultyOpen,
    handleChange,
    saveTemplateData,
  } = useSelectorsState();

  if (isLoading || !tree) {
    return <Loader />;
  }

  return (
    <Box sx={{ maxWidth: "700px", py: 1 }}>
      <Box sx={{ fontSize: "15px", fontWeight: "600", py: 1 }}>Институт</Box>
      <Autocomplete
        value={selectors.faculty}
        onChange={handleChange("faculty")}
        options={getFacultyOptions(tree)}
        data-cy="faculty-select"
        open={isFacultyOpen}
        onOpen={() => setIsFacultyOpen(true)}
        onClose={() => setIsFacultyOpen(false)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Выберите институт"
            size="small"
            data-cy="text-field"
          />
        )}
      />
      {selectors.faculty && (
        <Selector
          title="Уровень образования"
          placeholder="Выберите уровень образования"
          value={selectors.levelEducation}
          onChange={handleChange("levelEducation")}
          options={getNestedOptions(tree, [selectors.faculty.value])}
          data-cy="education-level-select"
        />
      )}
      {selectors.faculty && selectors.levelEducation && (
        <Selector
          title="Направление обучения"
          placeholder="Выберите направление обучения"
          value={selectors.directionOfStudy}
          onChange={handleChange("directionOfStudy")}
          options={getNestedOptions(tree, [
            selectors.faculty.value,
            selectors.levelEducation.value,
          ])}
          data-cy="direction-select"
        />
      )}
      {selectors.faculty &&
        selectors.levelEducation &&
        selectors.directionOfStudy && (
          <Selector
            title="Профиль направления обучения"
            placeholder="Выберите профиль обучения"
            value={selectors.profile}
            onChange={handleChange("profile")}
            options={getNestedOptions(tree, [
              selectors.faculty.value,
              selectors.levelEducation.value,
              selectors.directionOfStudy.value,
            ])}
            data-cy="profile-select"
          />
        )}
      {selectors.faculty &&
        selectors.levelEducation &&
        selectors.directionOfStudy &&
        selectors.profile && (
          <Selector
            title="Форма обучения"
            placeholder="Выберите форму обучения"
            value={selectors.formEducation}
            onChange={handleChange("formEducation")}
            options={getNestedOptions(tree, [
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
            options={getNestedOptions(
              tree,
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
        <Button
          sx={{ my: 1 }}
          variant="contained"
          onClick={() => saveTemplateData(setChoise)}
        >
          Продолжить
        </Button>
      )}
    </Box>
  );
};
