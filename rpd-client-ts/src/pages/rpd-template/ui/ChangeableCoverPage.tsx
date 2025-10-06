import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import { TextareaAutosize as BaseTextareaAutosize } from "@mui/material";
import { styled } from "@mui/system";
import { Loader } from "@shared/ui";
import { axiosBase } from "@shared/api";

interface ChangeableCoverPageProps {
  title: string;
  defaultText?: string;
}

interface ValueData {
  id: string;
  value: string;
}

const ChangeableCoverPage = ({ title }: ChangeableCoverPageProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<ValueData | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await axiosBase.get(`rpd-changeable-values?title=${title}`);
      setValue(response.data);
    } catch (error) {
      console.error(error);
    }
  }, [title]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    if (!textAreaRef.current || !value?.id) return;

    try {
      const textareaValue = textAreaRef.current.value;
      const response = await axiosBase.put(`rpd-changeable-values/${value.id}`, { value: textareaValue });
      setValue(response.data);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    }
  };

  if (!value) {
    return <Loader />;
  }

  return (
    <Box>
      {isEditing ? (
        <Box>
          <TextareaAutosize
            ref={textAreaRef}
            aria-label="empty textarea"
            placeholder="Empty"
            id={title}
            defaultValue={value.value}
            sx={{ my: 1 }}
          />
          <Button variant="contained" size="small" endIcon={<SaveAltIcon color="primary" />} onClick={handleSaveClick}>
            сохранить изменения
          </Button>
        </Box>
      ) : (
        <Box>
          {value.value ? (
            <Box dangerouslySetInnerHTML={{ __html: value.value }} sx={{ py: 1 }} />
          ) : (
            <p>Нет доступного контента</p>
          )}
          <Button variant="outlined" size="small" endIcon={<EditIcon color="primary" />} onClick={handleEditClick}>
            редактировать
          </Button>
        </Box>
      )}
    </Box>
  );
};

const TextareaAutosize = styled(BaseTextareaAutosize)(
  () => `
    box-sizing: border-box;
    width: 100%;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.5;
    padding: 8px 12px;
    border-radius: 8px;
    color: #1C2025;
    background: #ffffff;
    border: 1px solid #DAE2ED;
    box-shadow: 0px 2px 2px #F3F6F9;

    &:hover {
        border-color: #3399FF;
    }

    &:focus {
        border-color: #3399FF;
        box-shadow: 0 0 0 3px #b6daff;
    }

    &:focus-visible {
        outline: 0;
    }
`
);

export default ChangeableCoverPage;
