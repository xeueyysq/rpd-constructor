import { FC, useState } from "react";
import { Box, Button } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { useStore } from "@shared/hooks";
import TextEditor from "./TextEditor.tsx";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";
import { JsonChangeValueTypes } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { ExportFromTemplates } from "./ExportFromTemplates.tsx";

const JsonChangeValue: FC<JsonChangeValueTypes> = ({ elementName }) => {
  const { updateJsonData } = useStore();
  const elementValue = useStore.getState().jsonData[elementName];

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [changeableValue, setChangeableValue] = useState<string>(elementValue || "");

  const handleEditClick = () => {
    setIsEditing(true);
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
              sx={{ alignSelf: "flex-start" }}
            >
              Редактировать
            </Button>
            <ExportFromTemplates elementName={elementName} setChangeableValue={setChangeableValue} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default JsonChangeValue;
