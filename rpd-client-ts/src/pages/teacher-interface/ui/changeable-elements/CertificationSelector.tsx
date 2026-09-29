import { FC, useEffect, useState } from "react";
import { MenuItem, Select, SelectChangeEvent, useTheme } from "@mui/material";
import { useUpdateTemplateField } from "@entities/template";
import { useStore } from "@shared/hooks";

interface SelectorProps {
  certification: string;
  readOnly?: boolean;
}

const CertificationSelector: FC<SelectorProps> = ({
  certification,
  readOnly = false,
}) => {
  const theme = useTheme();
  const storeCertification = useStore((state) => state.jsonData.certification);
  const save = useUpdateTemplateField();
  const [valueCertification, setValueCertification] = useState<string>(
    certification || storeCertification || ""
  );

  useEffect(() => {
    setValueCertification(certification || storeCertification || "");
  }, [certification, storeCertification]);

  const handleChange = async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;

    setValueCertification(value);
    await save("certification", value);
  };

  return (
    <Select
      variant="standard"
      labelId="certification-select-label"
      id="certification-select"
      value={valueCertification}
      onChange={handleChange}
      disabled={readOnly}
      size="small"
      sx={{
        minWidth: "150px",
        ...(readOnly && {
          "& .MuiSelect-select.Mui-disabled": {
            WebkitTextFillColor: theme.palette.text.primary,
            opacity: 1,
          },
        }),
      }}
    >
      <MenuItem value="Зачет">зачет</MenuItem>
      <MenuItem value="Зачет с оценкой">зачет с оценкой</MenuItem>
      <MenuItem value="Экзамен">экзамен</MenuItem>
      <MenuItem value="Экзамен + курсовая работа">
        экзамен + курсовая работа
      </MenuItem>
    </Select>
  );
};
export default CertificationSelector;
