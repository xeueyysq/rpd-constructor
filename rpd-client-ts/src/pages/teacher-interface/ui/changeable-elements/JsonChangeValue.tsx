import EditIcon from "@mui/icons-material/Edit";
import { Box, Button } from "@mui/material";
import { JsonChangeValueTypes } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { useTemplateSync, useUpdateTemplateField } from "@entities/template";
import { useStore } from "@shared/hooks";
import { FC, useEffect, useState } from "react";
import { ExportFromTemplates } from "./ExportFromTemplates.tsx";
import TextEditor from "./TextEditor.tsx";

const JsonChangeValue: FC<JsonChangeValueTypes> = ({ elementName }) => {
  const elementValue = useStore((state) => state.jsonData[elementName]) as
    string | undefined;
  const save = useUpdateTemplateField();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  useEffect(
    () => () => {
      useTemplateSync.getState().clearDirty(elementName);
    },
    [elementName]
  );
  const handleEditClick = () => {
    useTemplateSync.getState().markDirty(elementName);
    setIsEditing(true);
  };

  const saveContent = async (htmlValue: string, changed: boolean) => {
    if (!changed) {
      useTemplateSync.getState().clearDirty(elementName);
      setIsEditing(false);
    } else {
      if (await save(elementName, htmlValue, { keepDraftOnConflict: true })) {
        setIsEditing(false);
      }
    }
  };

  const cancelEdit = (editing: boolean) => {
    if (!editing) useTemplateSync.getState().clearDirty(elementName);
    setIsEditing(editing);
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
          <Box sx={{ p: 1 }}>
            <TextEditor
              value={elementValue || ""}
              saveContent={saveContent}
              setIsEditing={cancelEdit}
            />
          </Box>
        ) : (
          <Box>
            {elementValue ? (
              <Box
                dangerouslySetInnerHTML={{ __html: elementValue }}
                sx={{ py: 1 }}
              ></Box>
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
            <Box
              sx={{ display: "flex", justifyContent: "space-between", pl: 1 }}
            >
              <Button
                variant="outlined"
                endIcon={<EditIcon color="primary" />}
                onClick={handleEditClick}
                sx={{ alignSelf: "flex-start" }}
              >
                Редактировать
              </Button>
              <ExportFromTemplates elementName={elementName} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default JsonChangeValue;
