import EditIcon from "@mui/icons-material/Edit";
import { Box, Button, ButtonGroup } from "@mui/material";
import { JsonChangeValueTypes } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { FC, useEffect, useState } from "react";
import { ExportFromTemplates } from "./ExportFromTemplates.tsx";
import TextEditor from "./TextEditor.tsx";

const JsonChangeValue: FC<JsonChangeValueTypes> = ({ elementName }) => {
  const updateJsonData = useStore((state) => state.updateJsonData);
  const templateId = useStore((state) => state.jsonData.id);
  const elementValue = useStore((state) => state.jsonData[elementName]);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [changeableValue, setChangeableValue] = useState<string>(elementValue || "");

  useEffect(() => {
    if (!isEditing) setChangeableValue(elementValue || "");
  }, [elementValue, templateId, isEditing]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const saveContent = async (htmlValue: string) => {
    setIsEditing(false);

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
    <Box>
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
          <Box p={1}>
            <TextEditor value={changeableValue} saveContent={saveContent} setIsEditing={setIsEditing} />
          </Box>
        ) : (
          <Box>
            {changeableValue ? (
              <Box dangerouslySetInnerHTML={{ __html: changeableValue }} sx={{ py: 1 }}></Box>
            ) : (
              <Box
                sx={{
                  py: 2,
                  pl: 1.5,
                  color: "grey",
                  fontStyle: "italic",
                }}
              >
                Данные не найдены
              </Box>
            )}
            <Box sx={{ display: "flex", justifyContent: "space-between", pl: 1 }}>
              <Button
                variant="outlined"
                endIcon={<EditIcon color="primary" />}
                onClick={handleEditClick}
                sx={{ alignSelf: "flex-start" }}
              >
                Редактировать
              </Button>
              <ExportFromTemplates
                elementName={elementName}
                setChangeableValue={(value) => setChangeableValue(value as string)}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default JsonChangeValue;
