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
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { getTemplateField } from "../model/api";
import { useQuery } from "@tanstack/react-query";
import CircularProgress from "@mui/material/CircularProgress";
import { DisciplineContentTable } from "./changeable-elements/DisciplineContentTable";
import { DisciplineContentData } from "../model/DisciplineContentPageTypes";

interface TemplateObject {
  id: number | undefined;
  text: string | undefined;
  year: number | undefined;
}

interface DataDialogBoxProps {
  id: string;
  keepMounted?: boolean;
  open: boolean;
  onClose: (type: string, value?: number) => void;
  options: TemplateObject[];
  title: string;
  fieldName: string;
}

export function DataDialogBox(props: DataDialogBoxProps) {
  const { onClose, open, options, title, fieldName, ...other } = props;
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
  } = useQuery({
    queryKey: ["template-fields", ids, fieldName],
    queryFn: () =>
      getTemplateField({
        ids,
        rowName: fieldName,
      }),
    enabled: ids.length > 0 && !!fieldName,
  });

  const handleEntering = () => {
    if (radioGroupRef.current != null) {
      radioGroupRef.current.focus();
    }
  };

  const handleCancel = () => {
    onClose(other.id);
    setExpandedItems(null);
    setValue(null);
  };

  const handleOk = () => {
    let parsedValue: number | undefined;
    if (value !== null && value !== undefined) {
      if (typeof value === "string") {
        const num = parseInt(value);
        parsedValue = isNaN(num) ? undefined : num;
      } else {
        parsedValue = value as number;
      }
    }
    onClose(other.id, parsedValue);
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
      fieldData?.find((row) => row.id === option.id)?.[
        fieldName as keyof (typeof fieldData)[0]
      ],
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
      TransitionProps={{ onEntering: handleEntering }}
      open={open}
      onClose={handleCancel}
      {...other}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {options.length ? (
          <RadioGroup ref={radioGroupRef} value={value} onChange={handleChange}>
            {options.map((option) => (
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
                    control={<Radio />}
                    label={`${option.text} (${option.year})`}
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
                    ) : typeof getCurrentFieldData(option) === "object" &&
                      getCurrentFieldData(option) !== null ? (
                      <Box>
                        <DisciplineContentTable
                          readOnly
                          tableData={
                            getCurrentFieldData(option) as DisciplineContentData
                          }
                        />
                      </Box>
                    ) : (
                      <Box
                        dangerouslySetInnerHTML={{
                          __html:
                            getCurrentFieldData(option) ||
                            "Нет данных для отображения",
                        }}
                        color="text.secondary"
                      />
                    )}
                  </Box>
                </Collapse>
              </Box>
            ))}
          </RadioGroup>
        ) : (
          <DialogContentText>Нет данных по другим шаблонам</DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={handleCancel}>
          Отмена
        </Button>
        {options.length ? (
          <Button disabled={!value} variant="contained" onClick={handleOk}>
            Выгрузить
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
