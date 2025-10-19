import { Box, IconButton, Paper } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";

type PageTitleProps = {
  title: string;
  backButton?: boolean;
};

export function PageTitle({ title, backButton }: PageTitleProps) {
  const navigate = useNavigate();

  const handleClickBack = () => {
    navigate(-1);
  };

  return (
    <Box display={"flex"} gap={1} alignItems={"center"}>
      {backButton && (
        <IconButton onClick={handleClickBack}>
          <ArrowBackRoundedIcon />
        </IconButton>
      )}
      <Box fontSize={"1.4rem"}>{title}</Box>
    </Box>
  );
}
