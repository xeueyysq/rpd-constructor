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
  useMyTemplates,
  useTemplateSync,
  type FieldEdits,
  type FieldEdit,
} from "@entities/template";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";
import { JsonChangeValueTypes } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { DisciplineContentData } from "@pages/teacher-interface/model/DisciplineContentPageTypes";

export function ExportFromTemplates({
  elementName,
  setChangeableValue,
}: JsonChangeValueTypes & {
  setChangeableValue?: (value: string | DisciplineContentData) => void;
}) {
  const [openFromYearDialog, setOpenFromYearDialog] = useState<boolean>(false);
  const [openFromDirectionDialog, setOpenFromDirectionDialog] =
    useState<boolean>(false);
  const { data: myTemplates = [] } = useMyTemplates();
  const teacherTemplates = myTemplates.map((row) => ({
    id: row.id,
    text: row.disciplins_name,
    year: row.year,
  }));
  const jsonData = useStore((state) => state.jsonData);
  const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
  const open = Boolean(anchorEl);
  const updateJsonData = useStore((state) => state.updateJsonData);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCloseDialog = async (type: string, value?: number | null) => {
    switch (type) {
      case "from-year-dialog":
        setOpenFromYearDialog(false);
        if (value) {
          await copyTemplateData(value, elementName);
        }
        break;
      case "from-direction-dialog":
        setOpenFromDirectionDialog(false);
        if (value) {
          await copyTemplateData(value, elementName);
        }
        break;
      default:
        break;
    }
  };

  const copyTemplateData = async (
    sourceTemplateId: number,
    fieldToCopy: string
  ) => {
    const currentTemplateId = jsonData.id;
    const sync = useTemplateSync.getState();
    const wasDirty = Boolean(sync.dirty[fieldToCopy]);
    sync.markDirty(fieldToCopy);

    try {
      const response = await useTemplateSync.getState().track(
        axiosBase.post<{
          success: boolean;
          value: string | DisciplineContentData;
          edit: FieldEdit;
        }>("/copy-template-data", {
          sourceTemplateId,
          targetTemplateId: currentTemplateId,
          fieldToCopy,
          appendParagraph: true,
        })
      );

      if (
        response.data.success &&
        useStore.getState().jsonData.id === currentTemplateId
      ) {
        updateJsonData(fieldToCopy, response.data.value);
        updateJsonData("field_edits", {
          ...(useStore.getState().jsonData.field_edits as
            FieldEdits | undefined),
          [fieldToCopy]: response.data.edit,
        });
        setChangeableValue?.(response.data.value);
      }
    } catch (error) {
      showErrorMessage("Ошибка при копировании данных");
      console.error(error);
    } finally {
      if (!wasDirty && useStore.getState().jsonData.id === currentTemplateId) {
        useTemplateSync.getState().clearDirty(fieldToCopy);
      }
    }
  };

  return (
    <Box>
      <IconButton
        id="basic-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <MoreHorizIcon sx={{ color: "black" }} />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{ list: { "aria-labelledby": "basic-button" } }}
      >
        <MenuItem
          onClick={() => {
            setOpenFromYearDialog(true);
            handleClose();
          }}
        >
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography
              sx={{ display: "block", m: "0" }}
              variant="button"
              color="grey"
              gutterBottom
            >
              Загрузить данные из шаблона
              <br /> другого года
            </Typography>
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setOpenFromDirectionDialog(true);
            handleClose();
          }}
        >
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography
              sx={{ display: "block", m: "0" }}
              variant="button"
              gutterBottom
              color="grey"
            >
              Загрузить данные из шаблона
              <br /> другого направления
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
      <DataDialogBox
        id={"from-year-dialog"}
        open={openFromYearDialog}
        title={"Выгрузить из другого года"}
        onClose={handleCloseDialog}
        options={teacherTemplates.filter(
          (option) =>
            option.year !== jsonData.year &&
            option.text === jsonData.disciplins_name
        )}
        fieldName={elementName}
      />
      <DataDialogBox
        id={"from-direction-dialog"}
        open={openFromDirectionDialog}
        title={"Выгрузить из другого направления"}
        onClose={handleCloseDialog}
        options={teacherTemplates.filter(
          (option) =>
            option.id !== jsonData.id &&
            option.text !== jsonData.disciplins_name
        )}
        fieldName={elementName}
      />
    </Box>
  );
}
