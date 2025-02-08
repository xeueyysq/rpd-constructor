import { useState, useEffect, useRef, ChangeEvent } from "react";

type PlannedResultsCellProps = {
  value: string;
  onValueChange: (newValue: string) => void;
  readOnly?: boolean;
};

interface TextAreaValues {
  know: string;
  beAble: string;
  own: string;
}

function PlannedResultsCell({
  value,
  onValueChange,
  readOnly = false,
}: PlannedResultsCellProps) {
  const [inputValue, setInputValue] = useState<TextAreaValues>(() => {
    try {
      return JSON.parse(value || '{"know":"","beAble":"","own":""}');
    } catch {
      return {
        know: "",
        beAble: "",
        own: "",
      };
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const knowRef = useRef<HTMLTextAreaElement>(null);
  const beAbleRef = useRef<HTMLTextAreaElement>(null);
  const ownRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    [knowRef.current, beAbleRef.current, ownRef.current].forEach((ref) => {
      if (ref) {
        adjustHeight(ref);
      }
    });
  }, [inputValue]);

  const handleDivClick = () => {
    if (!readOnly) {
      setIsEditing(true);
    }
  };

  const handleInputChange = (field: keyof TextAreaValues, value: string) => {
    const newValues = {
      ...inputValue,
      [field]: value,
    };
    setInputValue(newValues);
    onValueChange(JSON.stringify(newValues));
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
        ref={knowRef}
        value={inputValue.know}
        onChange={(e) => handleInputChange("know", e.target.value)}
        style={{
          resize: "none",
          fontFamily: "Times New Roman",
          fontSize: 16,
          overflow: "hidden",
          minHeight: "50px",
          padding: "5px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />
      <u>Уметь:</u>
      <textarea
        ref={beAbleRef}
        value={inputValue.beAble}
        onChange={(e) => handleInputChange("beAble", e.target.value)}
        style={{
          resize: "none",
          fontFamily: "Times New Roman",
          fontSize: 16,
          overflow: "hidden",
          minHeight: "50px",
          padding: "5px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />
      <u>Владеть:</u>
      <textarea
        ref={ownRef}
        value={inputValue.own}
        onChange={(e) => handleInputChange("own", e.target.value)}
        style={{
          resize: "none",
          fontFamily: "Times New Roman",
          fontSize: 16,
          overflow: "hidden",
          minHeight: "50px",
          padding: "5px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />
    </div>
  );

  //   return (
  //     <div
  //       onClick={handleDivClick}
  //       style={{
  //         fontFamily: "Times New Roman",
  //         fontSize: 16,
  //         whiteSpace: "pre-wrap",
  //         cursor: readOnly ? "default" : "pointer",
  //         backgroundColor: readOnly ? "#f5f5f5" : "white",
  //       }}
  //     >
  //       {value}
  //     </div>
  //   );
}

export default PlannedResultsCell;
