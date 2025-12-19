import DownloadIcon from "@mui/icons-material/Download";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import { DataDialogBox } from "../DataDialogBox";
import React, { useState } from "react";
import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";
import { JsonChangeValueTypes } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { DisciplineContentData } from "@pages/teacher-interface/model/DisciplineContentPageTypes";

export function ExportFromTemplates({
  elementName,
  setChangeableValue,
}: JsonChangeValueTypes & {
  setChangeableValue: (value: string | DisciplineContentData) => void;
}) {
  const [openFromYearDialog, setOpenFromYearDialog] = useState<boolean>(false);
  const [openFromDirectionDialog, setOpenFromDirectionDialog] = useState<boolean>(false);
  const teacherTemplates = useStore((state) => state.teacherTemplates);
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

  const copyTemplateData = async (sourceTemplateId: number, fieldToCopy: string) => {
    const currentTemplateId = jsonData.id;

    try {
      const response = await axiosBase.post("/copy-template-data", {
        sourceTemplateId,
        targetTemplateId: currentTemplateId,
        fieldToCopy,
      });

      if (response.data.success) {
        showSuccessMessage("Данные успешно скопированы");
        updateJsonData(fieldToCopy, response.data.targetTemplate[fieldToCopy]);
        setChangeableValue(response.data.targetTemplate[fieldToCopy]);
      }
    } catch (error) {
      showErrorMessage("Ошибка при копировании данных");
      console.error(error);
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
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
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
            <Typography variant="button" display="block" color="grey" gutterBottom m="0">
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
            <Typography variant="button" display="block" gutterBottom color="grey" m="0">
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
          (option) => option.year !== jsonData.year && option.text === jsonData.disciplins_name
        )}
        fieldName={elementName}
      />
      <DataDialogBox
        id={"from-direction-dialog"}
        open={openFromDirectionDialog}
        title={"Выгрузить из другого направления"}
        onClose={handleCloseDialog}
        options={teacherTemplates.filter(
          (option) => option.id !== jsonData.id && option.text !== jsonData.disciplins_name
        )}
        fieldName={elementName}
      />
    </Box>
  );
}
