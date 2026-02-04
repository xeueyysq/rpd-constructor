import { useAuth } from "@entities/auth";
import { Box, Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import { UserRole } from "@shared/ability";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useMemo, useState } from "react";
import TextEditor from "./TextEditor.tsx";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EditIcon from "@mui/icons-material/Edit";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

interface ICommentChangeValue {
  templateField: string;
  isEdittedComment: boolean;
  setIsEdittedComment: (value: boolean) => void;
}

export function CommentChangeValue({ templateField, isEdittedComment, setIsEdittedComment }: ICommentChangeValue) {
  const { userRole } = useAuth((state) => state);
  const { jsonData, updateJsonComment } = useStore((state) => state);
  const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
  const open = Boolean(anchorEl);
  const templateId = useStore((state) => state.jsonData.id);
  const comment = jsonData?.comments?.[templateField];
  const commentId = comment?.id as number | undefined;

  const commentText = useMemo(() => {
    const raw = comment?.comment_text;
    if (typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === "string" ? parsed : raw;
      } catch {
        return raw;
      }
    }
    return raw;
  }, [comment?.comment_text]);
  const hasComment = Boolean(commentText);

  const createdAtRaw = comment?.created_at as string | undefined;
  const updatedAtRaw = comment?.updated_at as string | undefined;

  const createdAt = useMemo(() => (createdAtRaw ? new Date(createdAtRaw) : undefined), [createdAtRaw]);
  const updatedAt = useMemo(() => (updatedAtRaw ? new Date(updatedAtRaw) : undefined), [updatedAtRaw]);
  const isEdited =
    Boolean(createdAt && updatedAt) &&
    Number.isFinite(createdAt!.getTime()) &&
    Number.isFinite(updatedAt!.getTime()) &&
    updatedAt!.getTime() - createdAt!.getTime() > 1000;

  const formatDateTime = (d?: Date) =>
    d && Number.isFinite(d.getTime())
      ? d.toLocaleString("ru-RU", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const saveComment = async (htmlValue: string) => {
    if (!templateId) {
      showErrorMessage("Шаблон не загружен");
      return;
    }
    try {
      const { data } = await axiosBase.put(`upset-template-comment/${templateId}`, {
        field: templateField,
        value: htmlValue,
      });

      showSuccessMessage("Данные успешно сохранены");
      updateJsonComment(templateField, data ?? htmlValue);
      setIsEdittedComment(false);
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  const deleteComment = async () => {
    setAnchorEl(null);
    try {
      if (!commentId) {
        showErrorMessage("Комментарий не найден");
        return;
      }
      await axiosBase.delete(`delete-template-comment/${commentId}`);
      updateJsonComment(templateField, undefined);
      setIsEdittedComment(false);
      showSuccessMessage("Комментарий удален");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  if (userRole === UserRole.TEACHER && !hasComment && !isEdittedComment) return null;

  return (
    <Box
      sx={{
        border: "1px dashed #ED6C02",
      }}
    >
      {!isEdittedComment ? (
        <Box>
          <Box
            sx={{
              px: 2,
              pt: 2,
              pb: 1,
              color: "#ED6C02",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box>
              <Typography display="block" gutterBottom m="0">
                Комментарий
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" m="0">
                {isEdited ? `Изменен: ${formatDateTime(updatedAt)}` : `Создан: ${formatDateTime(createdAt)}`}
              </Typography>
            </Box>
            <Typography color="text.secondary" display="block" gutterBottom m="0">
              Автор: {comment.commentator_id}
            </Typography>
          </Box>
          <Box pl={2}>
            <Typography dangerouslySetInnerHTML={{ __html: commentText }} />
          </Box>
          <Box p={2} pb={1}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              {userRole !== UserRole.TEACHER && (
                <Button
                  variant="outlined"
                  color="warning"
                  endIcon={<EditIcon />}
                  onClick={() => setIsEdittedComment(true)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Редактировать
                </Button>
              )}
              {userRole !== UserRole.TEACHER && (
                <IconButton
                  id="basic-button"
                  aria-controls={open ? "basic-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={open ? "true" : undefined}
                  onClick={handleClick}
                >
                  <MoreHorizIcon sx={{ color: "black" }} />
                </IconButton>
              )}
              <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                  "aria-labelledby": "basic-button",
                }}
              >
                <MenuItem onClick={deleteComment}>
                  <ListItemIcon>
                    <RemoveCircleOutlineIcon color="error" />
                  </ListItemIcon>
                  <ListItemText>
                    <Typography variant="button" display="block" gutterBottom color="error" m="0">
                      Удалить комментарий
                    </Typography>
                  </ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box p={2}>
          <TextEditor
            value={commentText ?? ""}
            saveContent={saveComment}
            setIsEditing={setIsEdittedComment}
            isComment={true}
          />
        </Box>
      )}
    </Box>
  );
}
