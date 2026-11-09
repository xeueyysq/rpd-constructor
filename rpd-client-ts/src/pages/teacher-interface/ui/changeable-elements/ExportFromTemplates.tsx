import DownloadIcon from "@mui/icons-material/Download";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { DataDialogBox } from "../DataDialogBox";
import { useState } from "react";
import {
  fieldImportOptions,
  templateImportError,
  useCopyTemplateField,
  useImportSources,
  type FieldEdits,
  type ImportField,
} from "@entities/template";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";

export function ExportFromTemplates({
  elementName,
  setChangeableValue,
}: {
  elementName: string;
  setChangeableValue?: (value: unknown) => void;
}) {
  const jsonData = useStore((state) => state.jsonData);
  const [mode, setMode] = useState<"year" | "direction" | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
  const [baseAt, setBaseAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const sources = useImportSources({ targetTemplateId: jsonData.id }, false);
  const copy = useCopyTemplateField();

  const openDialog = async (nextMode: "year" | "direction") => {
    setAnchorEl(null);
    setPreparing(true);
    try {
      await sources.refetch({ throwOnError: true });
      const target = useStore.getState().jsonData;
      if (target.id !== jsonData.id) return;
      setBaseAt(
        (target.field_edits as FieldEdits | undefined)?.[elementName]?.at ??
          null
      );
      setError(null);
      setMode(nextMode);
    } catch (error) {
      if (useStore.getState().jsonData.id === jsonData.id)
        showErrorMessage(templateImportError(error));
    } finally {
      setPreparing(false);
    }
  };

  const closeDialog = async (_type: string, sourceTemplateId?: number) => {
    if (copy.isPending) return false;
    if (sourceTemplateId == null) {
      setMode(null);
      return true;
    }
    try {
      const response = await copy.mutateAsync({
        sourceTemplateId,
        targetTemplateId: jsonData.id,
        fieldToCopy: elementName as ImportField,
        baseAt,
      });
      if (useStore.getState().jsonData.id === jsonData.id)
        setChangeableValue?.(response.value);
      setMode(null);
      return true;
    } catch (error) {
      setError(templateImportError(error));
      return false;
    }
  };

  const reload = async () => {
    const refreshed = await sources.refetch();
    const target = useStore.getState().jsonData;
    if (refreshed.isError || target.id !== jsonData.id) return;
    setBaseAt(
      (target.field_edits as FieldEdits | undefined)?.[elementName]?.at ?? null
    );
    setError(null);
  };
  const options = mode
    ? fieldImportOptions(
        sources.data?.complects ?? [],
        {
          id: jsonData.id,
          disciplins_name: jsonData.disciplins_name,
          direction: jsonData.direction,
          profile: jsonData.profile,
          year: jsonData.year,
        },
        mode
      )
    : [];

  return (
    <Box>
      <IconButton
        aria-label="Импортировать поле"
        aria-haspopup="true"
        aria-expanded={Boolean(anchorEl)}
        disabled={preparing || copy.isPending}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <MoreHorizIcon sx={{ color: "text.primary" }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => void openDialog("year")}>
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="button" sx={{ color: "text.secondary" }}>
              Загрузить данные из шаблона
              <br />
              другого комплекта
            </Typography>
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={() => void openDialog("direction")}>
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="button" sx={{ color: "text.secondary" }}>
              Загрузить данные из шаблона
              <br />
              другого направления
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
      {mode && (
        <DataDialogBox
          id={mode === "year" ? "from-year-dialog" : "from-direction-dialog"}
          open
          title={
            mode === "year"
              ? "Загрузить из другого комплекта"
              : "Загрузить из другого направления"
          }
          onClose={closeDialog}
          options={options}
          fieldName={elementName as ImportField}
          targetTemplateId={jsonData.id}
          busy={copy.isPending || sources.isFetching}
          errorMessage={
            error ??
            (sources.isError ? templateImportError(sources.error) : null)
          }
          onReload={() => void reload()}
        />
      )}
    </Box>
  );
}
