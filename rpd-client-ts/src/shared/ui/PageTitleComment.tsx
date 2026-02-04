import { useAuth } from "@entities/auth";
import AddCommentIcon from "@mui/icons-material/AddComment";
import { Box, BoxProps, IconButton } from "@mui/material";
import { CommentChangeValue } from "@pages/teacher-interface/ui/changeable-elements/CommentChangeValue";
import { UserRole } from "@shared/ability";
import { useStore } from "@shared/hooks";
import { useMemo, useState } from "react";
import { PageTitle } from "./PageTitle";

type PageTitleCommentProps = BoxProps & {
  title: string;
  templateField: string;
};

export function PageTitleComment(props: PageTitleCommentProps) {
  const { title, templateField } = props;
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

  if (userRole !== UserRole.TEACHER && !hasComment && !isEdittedComment)
    return (
      <Box {...props} display={"flex"} gap={2} alignItems={"center"}>
        <PageTitle title={title} />
        <IconButton
          onClick={() => {
            setIsEdittedComment(true);
          }}
          sx={{ alignSelf: "flex-start" }}
          color="warning"
        >
          <AddCommentIcon />
        </IconButton>
      </Box>
    );

  return (
    <Box>
      <PageTitle {...props} title={title} />
      <CommentChangeValue
        templateField={templateField}
        isEdittedComment={isEdittedComment}
        setIsEdittedComment={setIsEdittedComment}
      />
    </Box>
  );
}
