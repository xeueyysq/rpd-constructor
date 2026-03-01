import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  useTheme,
} from "@mui/material";
import { useAuth } from "@entities/auth";
import { PlannedResultsData } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes";
import { UserRole } from "@shared/ability";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Loader, PageTitleComment } from "@shared/ui";
import { isAxiosError } from "axios";
import {
  FC,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const RESULT_KEYS = ["own", "know", "beAble"] as const;
type ResultKey = (typeof RESULT_KEYS)[number];

type PlannedRow = PlannedResultsData[string];

const useSyncRowTextareasHeight = (values: string[]) => {
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const textareasRef = useRef<Array<HTMLTextAreaElement | null>>([]);

  const registerTextarea =
    (idx: number) => (el: HTMLTextAreaElement | null) => {
      textareasRef.current[idx] = el;
    };

  const syncHeights = () => {
    const els = textareasRef.current.filter(Boolean) as HTMLTextAreaElement[];
    if (!els.length) return;

    for (const el of els) el.style.height = "auto";

    const max = Math.max(...els.map((el) => el.scrollHeight));
    for (const el of els) el.style.height = `${max}px`;
  };

  useLayoutEffect(() => {
    syncHeights();
  }, values);

  useEffect(() => {
    const onResize = () => requestAnimationFrame(syncHeights);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { rowRef, registerTextarea };
};

const cellTextFieldSx = {
  flex: 1,
  fontSize: "14px !important",
  "& .MuiInputBase-root": { alignItems: "flex-start", borderRadius: 0 },
  "& .MuiOutlinedInput-root": {
    borderRadius: 0,
    "& fieldset": { border: "none" },
  },
  "& .MuiInputBase-input": { fontSize: "14px !important" },
  "& textarea": { boxSizing: "border-box", resize: "none", overflow: "hidden" },
} as const;

const PlannedResultsTableRow: FC<{
  rowKeyStr: string;
  row: PlannedRow;
  readOnly: boolean;
  onChangeBase: (
    id: number,
    value: string,
    key: "competence" | "indicator"
  ) => void;
  onChangeResult: (id: number, value: string, key: ResultKey) => void;
}> = ({ rowKeyStr, row, readOnly, onChangeBase, onChangeResult }) => {
  const theme = useTheme();
  const id = Number(rowKeyStr);
  const cellSx = {
    ...cellTextFieldSx,
    ...(readOnly && {
      "& .MuiInputBase-input.Mui-disabled": {
        WebkitTextFillColor: theme.palette.text.primary,
        opacity: 1,
      },
    }),
  };
  const values = useMemo(
    () => [
      row.competence,
      row.indicator,
      row.results.own,
      row.results.know,
      row.results.beAble,
    ],
    [
      row.competence,
      row.indicator,
      row.results.own,
      row.results.know,
      row.results.beAble,
    ]
  );
  const { rowRef, registerTextarea } = useSyncRowTextareasHeight(values);

  return (
    <TableRow ref={rowRef} key={rowKeyStr}>
      <TableCell sx={{ p: 0, verticalAlign: "top" }}>
        <Box sx={{ display: "flex" }}>
          <TextField
            fullWidth
            sx={cellSx}
            multiline
            minRows={1}
            value={row.competence}
            onChange={(e) => onChangeBase(id, e.target.value, "competence")}
            inputRef={registerTextarea(0)}
            disabled={readOnly}
          />
        </Box>
      </TableCell>
      <TableCell sx={{ p: 0, verticalAlign: "top" }}>
        <Box sx={{ display: "flex" }}>
          <TextField
            fullWidth
            sx={cellSx}
            multiline
            minRows={1}
            value={row.indicator}
            onChange={(e) => onChangeBase(id, e.target.value, "indicator")}
            inputRef={registerTextarea(1)}
            disabled={readOnly}
          />
        </Box>
      </TableCell>
      {RESULT_KEYS.map((resultKey, idx) => (
        <TableCell key={resultKey} sx={{ p: 0, verticalAlign: "top" }}>
          <Box sx={{ display: "flex" }}>
            <TextField
              fullWidth
              sx={cellSx}
              multiline
              minRows={1}
              value={row.results[resultKey]}
              onChange={(e) => onChangeResult(id, e.target.value, resultKey)}
              inputRef={registerTextarea(2 + idx)}
              disabled={readOnly}
            />
          </Box>
        </TableCell>
      ))}
    </TableRow>
  );
};

const PlannedResultsPage: FC = () => {
  const userRole = useAuth((state) => state.userRole);
  const readOnly = userRole === UserRole.TEACHER;
  const disciplineName = useStore(
    (state) => state.jsonData.disciplins_name
  ) as string;
  const initialData = useStore((state) => state.jsonData.competencies) as
    | PlannedResultsData
    | undefined;
  const { updateJsonData } = useStore();
  const [data, setData] = useState<PlannedResultsData | undefined>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const saveData = async () => {
    if (!data) return;
    const id = useStore.getState().jsonData.id;

    try {
      await axiosBase.put(`update-json-value/${id}`, {
        fieldToUpdate: "competencies",
        value: data,
      });

      updateJsonData("competencies", data);
      showSuccessMessage("Данные успешно сохранены");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      if (isAxiosError(error)) {
        console.error("Ошибка Axios:", error.response?.data);
        console.error("Статус ошибки:", error.response?.status);
        console.error("Заголовки ошибки:", error.response?.headers);
      } else {
        console.error("Неизвестная ошибка:", error);
      }
    }
  };

  const handleChangeResult = (id: number, value: string, key: ResultKey) => {
    if (!data) return;
    setData({
      ...data,
      [id]: {
        ...data[id],
        results: {
          ...data[id].results,
          [key]: value,
        },
      },
    });
  };

  const handleChangeBaseCell = (
    id: number,
    value: string,
    key: "competence" | "indicator"
  ) => {
    if (!data) return;
    setData({
      ...data,
      [id]: {
        ...data[id],
        [key]: value,
      },
    });
  };

  const complectId = useStore.getState().complectId;

  useEffect(() => {
    if (data && Object.keys(data).length) return;
    if (!complectId) return;

    (async () => {
      try {
        const response = await axiosBase.get("get-results-data", {
          params: { complectId },
        });
        type Row = {
          competence: string;
          indicator: string;
          disciplines: string[];
        };
        const rows = response.data as Row[];
        const filtered = rows.filter((r) =>
          r.disciplines.includes(disciplineName)
        );

        const mapped: PlannedResultsData = {};
        let idx = 0;
        let lastCompetence = "";
        filtered.forEach((r) => {
          const competenceToSet =
            r.competence === lastCompetence ? "" : r.competence;
          lastCompetence = r.competence;
          mapped[idx++] = {
            competence: competenceToSet,
            indicator: r.indicator,
            results: { know: "", beAble: "", own: "" },
          };
        });

        setData(mapped);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [data, complectId, disciplineName]);

  if (!data) return <Loader />;

  return (
    <Box>
      <PageTitleComment
        title="Планируемые результаты обучения по дисциплине (модулю)"
        paddingBottom={2}
        templateField={TemplatePagesPath.DISCIPLINE_PLANNED_RESULTS}
      />
      {!readOnly && (
        <Box pt={2} display={"flex"} justifyContent="flex-end" gap={1}>
          <Button variant="contained" onClick={saveData}>
            Сохранить
          </Button>
        </Box>
      )}
      <TableContainer component={Paper} sx={{ my: 2, borderRadius: 0 }}>
        <Table
          sx={{
            "& tbody td": { padding: "0 !important" },
          }}
          aria-label="simple table"
          size="small"
          className="table"
        >
          <TableHead>
            <TableRow>
              <TableCell align="center" rowSpan={2}>
                Формируемые компетенции (код и наименование)
              </TableCell>
              <TableCell align="center" rowSpan={2}>
                Индикаторы достижения компетенций (код и формулировка)
              </TableCell>
              <TableCell
                colSpan={3}
                align="center"
                sx={{
                  textAlign: "center",
                }}
              >
                Планируемые результаты обучения по дисциплине (модулю)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell align="center">Владеть</TableCell>
              <TableCell align="center">Знать</TableCell>
              <TableCell align="center">Уметь</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(data).map((key) => (
              <PlannedResultsTableRow
                key={key}
                rowKeyStr={key}
                row={data[key]}
                readOnly={readOnly}
                onChangeBase={handleChangeBaseCell}
                onChangeResult={handleChangeResult}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PlannedResultsPage;
