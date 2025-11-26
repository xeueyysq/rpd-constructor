import { TableCell } from "@mui/material";
import { Results } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { useState } from "react";
import { CellTextArea } from "./CellTextArea";

type PlannedResultsCellProps = {
  value: Results;
  onValueChange: (newValue: Results) => void;
};

function PlannedResultsCell({ value, onValueChange }: PlannedResultsCellProps) {
  const [inputValue, setInputValue] = useState<Results>(value);

  const handleInputChange = (field: string, value: string) => {
    const newValues = {
      ...inputValue,
      [field]: value,
    };
    setInputValue(newValues);
    onValueChange(newValues);

    const textarea = document.getElementById(field);
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const cellTitles = {
    know: "Знать",
    beAble: "Уметь",
    own: "Владеть",
  };

  return (
    <TableCell>
      {Object.entries(inputValue).map(([key, value]) => {
        return <CellTextArea title={cellTitles[key as keyof typeof cellTitles]} value={value} onChange={handleInputChange} fieldKey={key} />;
      })}
    </TableCell>
  );
}

export default PlannedResultsCell;
