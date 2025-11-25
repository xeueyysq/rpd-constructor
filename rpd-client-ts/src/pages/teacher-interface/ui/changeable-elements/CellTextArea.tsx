interface ICellTextArea {
  title: string;
  value: string;
  fieldKey: string;
  onChange: (field: string, value: string) => void;
}

export function CellTextArea({ title, value, fieldKey, onChange: handleInputChange }: ICellTextArea) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "Times New Roman",
        fontSize: 16,
      }}
    >
      <u>{title}:</u>
      <textarea
        value={value}
        onChange={(e) => handleInputChange(fieldKey, e.target.value)}
        style={{
          resize: "none",
          fontFamily: "Times New Roman",
          fontSize: 16,
          overflow: "hidden",
          minHeight: "50px",
          padding: "5px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
