import { TextField } from "@mui/material";
import { ChangeEvent, FC, useEffect, useState } from "react";

interface EditableNumberProps {
  value: number;
  onValueChange: (value: number) => void;
  readOnly?: boolean;
}

export const EditableNumber: FC<EditableNumberProps> = ({ value, onValueChange, readOnly }) => {
  const [inputValue, setInputValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleDivClick = () => {
    if (!readOnly) setIsEditing(true);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (value >= 0) setInputValue(value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    onValueChange(inputValue);
  };

  if (isEditing) {
    return (
      <TextField
        type="number"
        fullWidth
        autoFocus
        sx={{ fontSize: "14px !important", "& .MuiInputBase-input": { fontSize: "14px !important" } }}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
      />
    );
  }

  return (
    <div
      onClick={handleDivClick}
      style={{ alignContent: "center", textAlign: "center", minHeight: "100%", padding: "10px" }}
    >
      {value}
    </div>
  );
};
