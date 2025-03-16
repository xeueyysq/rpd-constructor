import { useState } from "react";
import { Results } from "@pages/teacher-interface/model/DisciplineContentPageTypes";

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

  const styles = {
    resize: "none" as const,
    fontFamily: "Times New Roman",
    fontSize: 16,
    overflow: "hidden",
    minHeight: "50px",
    padding: "5px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    boxSizing: "border-box" as const,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "Times New Roman",
        fontSize: 16,
      }}
    >
      <u>Знать:</u>
      <textarea
        id="know"
        value={inputValue.know}
        onChange={(e) => handleInputChange("know", e.target.value)}
        style={styles}
      />
      <u>Уметь:</u>
      <textarea
        id="beAble"
        value={inputValue.beAble}
        onChange={(e) => handleInputChange("beAble", e.target.value)}
        style={styles}
      />
      <u>Владеть:</u>
      <textarea
        id="own"
        value={inputValue.own}
        onChange={(e) => handleInputChange("own", e.target.value)}
        style={styles}
      />
    </div>
  );
}

export default PlannedResultsCell;
