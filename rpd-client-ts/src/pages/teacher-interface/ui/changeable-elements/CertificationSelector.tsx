import { FC, useEffect, useState } from "react";
import { MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";

interface SelectorProps {
  certification: string;
}

const CertificationSelector: FC<SelectorProps> = ({ certification }) => {
  const templateId = useStore((state) => state.jsonData.id);
  const storeCertification = useStore((state) => state.jsonData.certification);
  const updateJsonData = useStore((state) => state.updateJsonData);
  const [valueCertification, setValueCertification] = useState<string>(certification || storeCertification || "");

  useEffect(() => {
    setValueCertification(certification || storeCertification || "");
  }, [certification, storeCertification, templateId]);

  const handleChange = async (event: SelectChangeEvent<string>) => {
    const value = event.target.value;

    try {
      await axiosBase.put(`update-json-value/${templateId}`, {
        fieldToUpdate: "certification",
        value: value,
      });

      showSuccessMessage("Данные успешно сохранены");
      updateJsonData("certification", value);
      setValueCertification(value);
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  return (
    <Select
      variant="standard"
      labelId="certification-select-label"
      id="certification-select"
      value={valueCertification}
      onChange={handleChange}
      size="small"
      sx={{
        minWidth: "150px",
      }}
    >
      <MenuItem value="Зачет">зачет</MenuItem>
      <MenuItem value="Зачет с оценкой">зачет с оценкой</MenuItem>
      <MenuItem value="Экзамен">экзамен</MenuItem>
      <MenuItem value="Экзамен + курсовая работа">экзамен + курсовая работа</MenuItem>
    </Select>
  );
};
export default CertificationSelector;
