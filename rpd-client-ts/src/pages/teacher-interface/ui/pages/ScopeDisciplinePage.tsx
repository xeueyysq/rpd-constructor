import { Box, Button, TextField } from "@mui/material";
import { FC, useMemo, useState } from "react";
import { useStore } from "@shared/hooks";
import { PageTitle } from "@shared/ui";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { CommentChangeValue } from "../changeable-elements/CommentChangeValue";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes";

interface StudyLoadItem {
  id: string;
  name: string;
}

function normalizeStudyLoad(studyLoad: unknown): StudyLoadItem[] {
  if (!studyLoad) return [];

  if (Array.isArray(studyLoad)) {
    return studyLoad
      .map((item) => {
        const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const name = rec.name ?? rec.type ?? rec.title;
        const id = rec.id ?? rec.hours ?? rec.value;
        return {
          name: name !== undefined ? String(name) : "",
          id: id !== undefined ? String(id) : "",
        };
      })
      .filter((x) => x.name || x.id);
  }

  if (typeof studyLoad === "object") {
    return Object.entries(studyLoad as Record<string, unknown>)
      .map(([name, val]) => {
        if (val && typeof val === "object") {
          const v = val as Record<string, unknown>;
          const hours = v.id ?? v.hours ?? v.value;
          return { name: String(name), id: hours !== undefined ? String(hours) : "" };
        }
        return { name: String(name), id: val !== undefined ? String(val) : "" };
      })
      .filter((x) => x.name || x.id);
  }

  return [];
}

const ScopeDisciplinePage: FC = () => {
  const jsonData = useStore((state) => state.jsonData);
  const templateId = useStore((state) => state.jsonData.id);
  const updateJsonData = useStore((state) => state.updateJsonData);

  const studyLoadItems = useMemo(() => normalizeStudyLoad(jsonData.study_load), [jsonData.study_load]);
  const summHours = useMemo(() => {
    if (!studyLoadItems.length) return null;
    let summ = 0;
    for (const value of studyLoadItems) {
      const hours = Number(value.id);
      if (Number.isFinite(hours)) summ += hours;
    }
    return summ;
  }, [studyLoadItems]);

  const [manualHours, setManualHours] = useState<string | number | null>(summHours);
  const [creditUnits, setCreditUtins] = useState<string | null>(jsonData.zet);

  const saveManualHours = async () => {
    const parsed = Number(manualHours);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showErrorMessage("Введите корректное число часов");
      return;
    }
    const parsedZet = Number(creditUnits);
    if (!Number.isFinite(parsedZet) || parsedZet < 0) {
      showErrorMessage("Введите корректное число зачетных единиц");
      return;
    }
    if (!templateId) return;

    const nextStudyLoad: StudyLoadItem[] = [{ name: "Всего", id: String(parsed) }];
    const nextZet = String(parsedZet);

    try {
      await Promise.all([
        axiosBase.put(`update-json-value/${templateId}`, {
          fieldToUpdate: "study_load",
          value: nextStudyLoad,
        }),
        axiosBase.put(`update-json-value/${templateId}`, {
          fieldToUpdate: "zet",
          value: nextZet,
        }),
      ]);
      updateJsonData("study_load", nextStudyLoad);
      updateJsonData("zet", nextZet);
      showSuccessMessage("Данные сохранены");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  return (
    <Box>
      <PageTitle title="Объем дисциплины" paddingBottom={2} />
      <CommentChangeValue templateField={TemplatePagesPath.DISCIPLINE_SCOPE} />
      <Box sx={{ py: 2 }}>
        Объем дисциплины составляет
        <Box component="span" sx={{ fontWeight: "600", display: "inline-flex", mx: 1, alignItems: "baseline" }}>
          <TextField
            variant="standard"
            type="number"
            value={creditUnits}
            placeholder="?"
            onChange={(e) => setCreditUtins(e.target.value)}
            sx={{
              width: 80,
              "& .MuiInputBase-input": {
                textAlign: "center",
              },
            }}
          />
        </Box>
        зачетных единиц, всего
        <Box component="span" sx={{ fontWeight: "600", display: "inline-flex", mx: 1, alignItems: "baseline" }}>
          <TextField
            variant="standard"
            type="number"
            value={manualHours}
            placeholder="?"
            onChange={(e) => setManualHours(e.target.value)}
            sx={{
              width: 80,
              "& .MuiInputBase-input": {
                textAlign: "center",
              },
            }}
          />
        </Box>
        академических часа(ов)
      </Box>

      <Box sx={{ pt: 1 }}>
        <Button variant="contained" onClick={saveManualHours}>
          Сохранить
        </Button>
      </Box>
    </Box>
  );
};

export default ScopeDisciplinePage;
