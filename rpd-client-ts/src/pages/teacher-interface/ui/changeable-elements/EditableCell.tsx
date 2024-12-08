import { useState, useEffect, useRef, ChangeEvent } from 'react';

type EditableCellProps = {
    value: string;
    onValueChange: (newValue: string) => void;
    readOnly?: boolean;
};

function EditableCell({ value, onValueChange, readOnly = false }: EditableCellProps) {
    const [inputValue, setInputValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.style.height = "0px";
            const scrollHeight = textAreaRef.current.scrollHeight;
            textAreaRef.current.style.height = scrollHeight + "px";
        }
    }, [isEditing, inputValue]);

    const handleDivClick = () => {
        if (!readOnly) {
            setIsEditing(true);
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
    };
//const handleInputBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    const handleInputBlur = () => {
        setIsEditing(false);
        onValueChange(inputValue);
    };

    if (isEditing) {
        return (
            <textarea
                ref={textAreaRef}
                autoFocus
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                style={{ height: "auto", overflowY: "hidden" }}
            />
        );
    }

    return (
        <div 
            onClick={handleDivClick}
            style={{ 
                whiteSpace: 'pre-wrap', 
                cursor: readOnly ? 'default' : 'pointer',
                backgroundColor: readOnly ? '#f5f5f5' : 'white'
            }}
        >
            {value}
        </div>
    );
}

export default EditableCell;
