import { FC, MouseEvent, useState } from "react";
import { Box, Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { useStore } from "@shared/hooks";
import TextEditor from "./TextEditor.tsx";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import DownloadIcon from "@mui/icons-material/Download";
import { axiosBase } from "@shared/api";
import { DataDialogBox } from "../DataDialogBox.tsx";
import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";

interface JsonChangeValue {
  elementName: string;
}

const JsonChangeValue: FC<JsonChangeValue> = ({ elementName }) => {
  const [openFromYearDialog, setOpenFromYearDialog] = useState<boolean>(false);
  const [openFromDirectionDialog, setOpenFromDirectionDialog] = useState<boolean>(false);
  const { updateJsonData } = useStore();
  const elementValue = useStore.getState().jsonData[elementName];
  const teacherTemplates = useStore.getState().teacherTemplates;
  const JsonData = useStore.getState().jsonData;

  const userRole = useAuth.getState().userRole;
  const isTeacher = userRole === UserRole.TEACHER;

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [changeableValue, setChangeableValue] = useState<string>(elementValue || "");

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCloseDialog = async (type: string, value?: number) => {
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
    const currentTemplateId = useStore.getState().jsonData.id;

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

  const saveContent = async (htmlValue: string) => {
    setIsEditing(false);
    const templateId = useStore.getState().jsonData.id;

    try {
      await axiosBase.put(`update-json-value/${templateId}`, {
        fieldToUpdate: elementName,
        value: htmlValue,
      });

      showSuccessMessage("Данные успешно сохранены");
      updateJsonData(elementName, htmlValue);
      setChangeableValue(htmlValue);
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  return (
    <Box
      sx={{
        p: 1,
        border: "1px dashed grey",
        my: 1,
        textAlign: "justify",
        "& ol": {
          p: 1,
        },
        "& li": {
          ml: "60px",
        },
        "& p": {
          p: 1,
          textIndent: "1.5em",
        },
      }}
    >
      {isEditing ? (
        <TextEditor value={changeableValue} saveContent={saveContent} setIsEditing={setIsEditing} />
      ) : (
        <Box>
          {changeableValue ? (
            <Box dangerouslySetInnerHTML={{ __html: changeableValue }} sx={{ py: 1 }}></Box>
          ) : (
            <Box
              sx={{
                py: 2,
                color: "grey",
                fontStyle: "italic",
              }}
            >
              Данные не найдены
            </Box>
          )}
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Button
              variant="outlined"
              size="small"
              endIcon={<EditIcon color="primary" />}
              onClick={() => handleEditClick()}
            >
              редактировать
            </Button>
            {isTeacher && (
              <Box>
                <IconButton
                  id="basic-button"
                  size="small"
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
                  <MenuItem onClick={() => setOpenFromYearDialog(true)}>
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
                  <MenuItem onClick={() => setOpenFromDirectionDialog(true)}>
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
                    (option) => option.year !== JsonData.year && option.text === JsonData.disciplins_name
                  )}
                  fieldName={elementName}
                />
                <DataDialogBox
                  id={"from-direction-dialog"}
                  open={openFromDirectionDialog}
                  title={"Выгрузить из другого направления"}
                  onClose={handleCloseDialog}
                  options={teacherTemplates.filter(
                    (option) => option.id !== JsonData.id && option.text !== JsonData.disciplins_name
                  )}
                  fieldName={elementName}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default JsonChangeValue;
