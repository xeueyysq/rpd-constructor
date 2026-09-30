import { useAuth } from "@entities/auth";
import { FieldEditLabel } from "@entities/template";
import AddCommentIcon from "@mui/icons-material/AddComment";
import { Box, BoxProps, IconButton } from "@mui/material";
import { CommentChangeValue } from "./changeable-elements/CommentChangeValue";
import { UserRole } from "@shared/ability";
import { useStore } from "@shared/hooks";
import { useMemo, useState, type ReactNode } from "react";
import { PageTitle } from "@shared/ui";

type PageTitleCommentProps = BoxProps & {
  title: string;
  templateField: string;
  fields?: string[];
  // Кнопки справа от заголовка (например, подсказка по разделу).
  actions?: ReactNode;
};

export function PageTitleComment(props: PageTitleCommentProps) {
  const { title, templateField, fields, actions, sx, ...boxProps } = props;
  const [isEdittedComment, setIsEdittedComment] = useState<boolean>(false);
  const { userRole } = useAuth((state) => state);
  const { jsonData } = useStore((state) => state);
  const comment = jsonData?.comments?.[templateField];

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
  const canAddComment =
    userRole !== UserRole.TEACHER && !hasComment && !isEdittedComment;

  // Отметка «Изменено» — часть заголовка, комментарий — отдельный блок ниже.
  // Отступ между ними задаёт sx страницы (pb у заголовка).
  return (
    <Box>
      <Box {...boxProps} sx={sx}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <PageTitle title={title} />
          {actions}
          {canAddComment && (
            <IconButton
              aria-label="Добавить комментарий"
              onClick={() => {
                setIsEdittedComment(true);
              }}
              color="warning"
            >
              <AddCommentIcon />
            </IconButton>
          )}
        </Box>
        {fields && <FieldEditLabel fields={fields} />}
      </Box>
      {!canAddComment && (
        <CommentChangeValue
          templateField={templateField}
          isEdittedComment={isEdittedComment}
          setIsEdittedComment={setIsEdittedComment}
        />
      )}
    </Box>
  );
}
