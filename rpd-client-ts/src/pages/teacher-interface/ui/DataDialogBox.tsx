import {
  Dialog,
  DialogTitle,
  DialogContent,
  RadioGroup,
  FormControlLabel,
  DialogActions,
  Button,
  Radio,
  DialogContentText,
  Collapse,
  Box,
  IconButton,
  Alert,
} from "@mui/material";
import { useState, useRef, useCallback } from "react";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import { useImportFieldPreview, type ImportField } from "@entities/template";
import CircularProgress from "@mui/material/CircularProgress";
import { DisciplineContentTable } from "./changeable-elements/DisciplineContentTable";
import { DisciplineContentData } from "../model/DisciplineContentPageTypes";

interface TemplateObject {
  id: number;
  text: string;
  year: number | null;
}

interface DataDialogBoxProps {
  id: string;
  keepMounted?: boolean;
  open: boolean;
  onClose: (type: string, value?: number) => Promise<boolean>;
  options: TemplateObject[];
  title: string;
  fieldName: ImportField;
  targetTemplateId: number;
  busy: boolean;
  errorMessage: string | null;
  onReload: () => void;
}

export function DataDialogBox(props: DataDialogBoxProps) {
  const {
    onClose,
    open,
    options,
    title,
    fieldName,
    targetTemplateId,
    busy,
    errorMessage,
    onReload,
    ...other
  } = props;
  const [value, setValue] = useState<string | number | null>();
  const [expandedItems, setExpandedItems] = useState<Set<number> | null>(
    new Set()
  );
  const radioGroupRef = useRef<HTMLElement>(null);

  const ids = options.map((option) => option.id!).filter(Boolean);

  const {
    data: fieldData,
    isLoading,
    error,
    refetch,
  } = useImportFieldPreview(ids, fieldName, targetTemplateId, open);

  const handleEntering = () => {
    if (radioGroupRef.current != null) {
      radioGroupRef.current.focus();
    }
  };

  const handleCancel = () => {
    if (busy) return;
    void onClose(other.id);
    setExpandedItems(null);
    setValue(null);
  };

  const handleOk = async () => {
    let parsedValue: number | undefined;
    if (value !== null && value !== undefined) {
      if (typeof value === "string") {
        const num = parseInt(value);
        parsedValue = isNaN(num) ? undefined : num;
      } else {
        parsedValue = value as number;
      }
    }
    if (!(await onClose(other.id, parsedValue))) return;
    setExpandedItems(null);
    setValue(null);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue((event.target as HTMLInputElement).value);
  };

  const handleToggleExpand = (itemId: number) => {
    const newExpandedItems = new Set(expandedItems);
    if (newExpandedItems.has(itemId)) {
      newExpandedItems.delete(itemId);
    } else {
      newExpandedItems.add(itemId);
    }
    setExpandedItems(newExpandedItems);
  };

  const getCurrentFieldData = useCallback(
    (option: TemplateObject) =>
      fieldData?.find((row) => row.id === option.id)?.[fieldName],
    [fieldData, fieldName]
  );

  return (
    <Dialog
      sx={{
        "& .MuiDialog-paper": {
          maxHeight: 600,
        },
      }}
      maxWidth={"md"}
      slotProps={{ transition: { onEntering: handleEntering } }}
      open={open}
      onClose={handleCancel}
      {...other}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {errorMessage && (
          <Alert
            severity="error"
            sx={{ mb: 1 }}
            action={
              <Button
                disabled={busy}
                onClick={() => {
                  onReload();
                  void refetch();
                }}
              >
                Обновить данные
              </Button>
            }
          >
            {errorMessage}
          </Alert>
        )}
        {options.length ? (
          <RadioGroup
            ref={radioGroupRef}
            value={value ?? ""}
            onChange={handleChange}
          >
            {options.map((option) => {
              const currentFieldData = getCurrentFieldData(option);
              return (
                <Box key={option.id} sx={{ mb: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      border: "1px solid #e0e0e0",
                      borderRadius: 1,
                      p: 1,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <FormControlLabel
                      value={option.id}
                      control={<Radio disabled={busy} />}
                      label={option.text}
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      onClick={() => handleToggleExpand(option.id!)}
                      sx={{ ml: 1 }}
                    >
                      {expandedItems?.has(option.id!) ? (
                        <ExpandLess />
                      ) : (
                        <ExpandMore />
                      )}
                    </IconButton>
                  </Box>
                  <Collapse in={expandedItems?.has(option.id!)}>
                    <Box
                      sx={{
                        p: 2,
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #e0e0e0",
                        borderTop: "none",
                        borderRadius: "0 0 4px 4px",
                      }}
                    >
                      {isLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : error ? (
                        <Alert severity="error" sx={{ mb: 1 }}>
                          Ошибка загрузки данных: {error.message}
                        </Alert>
                      ) : Array.isArray(currentFieldData) ? (
                        <Box component="ol">
                          {currentFieldData.map((entry, index) => (
                            <Box component="li" key={index}>
                              {String(entry)}
                            </Box>
                          ))}
                        </Box>
                      ) : fieldName === "content" &&
                        typeof currentFieldData === "object" &&
                        currentFieldData !== null ? (
                        <Box>
                          <DisciplineContentTable
                            readOnly
                            tableData={
                              currentFieldData as DisciplineContentData
                            }
                          />
                        </Box>
                      ) : (
                        <Box
                          dangerouslySetInnerHTML={{
                            __html:
                              typeof currentFieldData === "string"
                                ? currentFieldData
                                : "Нет данных для отображения",
                          }}
                          sx={{ color: "text.secondary" }}
                        />
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </RadioGroup>
        ) : (
          <DialogContentText>Нет данных по другим шаблонам</DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button autoFocus disabled={busy} onClick={handleCancel}>
          Отмена
        </Button>
        {options.length ? (
          <Button
            disabled={
              !value ||
              !options.some((option) => option.id === Number(value)) ||
              busy ||
              isLoading ||
              Boolean(error) ||
              Boolean(errorMessage)
            }
            variant="contained"
            onClick={() => void handleOk()}
          >
            Загрузить
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
