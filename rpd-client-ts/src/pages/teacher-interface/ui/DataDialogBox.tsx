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
  Typography,
  IconButton,
  Alert,
} from "@mui/material";
import { useState, useRef } from "react";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { getTemplateField } from "../model/api";
import { useQuery } from "@tanstack/react-query";
import CircularProgress from "@mui/material/CircularProgress";

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
  const [value, setValue] = useState<string | number>();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
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
  };

  const handleOk = () => {
    onClose(other.id, typeof value === "string" ? parseInt(value) : value);
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

  return (
    <Dialog
      sx={{
        "& .MuiDialog-paper": {
          width: "80%",
          maxHeight: 435,
        },
      }}
      TransitionProps={{ onEntering: handleEntering }}
      open={open}
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
                  <IconButton size="small" onClick={() => handleToggleExpand(option.id!)} sx={{ ml: 1 }}>
                    {expandedItems.has(option.id!) ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                <Collapse in={expandedItems.has(option.id!)}>
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
                    ) : (
                      <Box
                        dangerouslySetInnerHTML={{
                          __html:
                            fieldData?.find((row) => row.id === option.id)?.[
                              fieldName as keyof (typeof fieldData)[0]
                            ] || "Нет данных для отображения",
                        }}
                        color="text.secondary"
                      ></Box>
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
          <Button variant="contained" onClick={handleOk}>
            Выгрузить
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
