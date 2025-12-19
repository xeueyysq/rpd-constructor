import { Box, IconButton, BoxProps } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";

type PageTitleProps = BoxProps & {
  title: string;
  backButton?: boolean;
};

export function PageTitle(props: PageTitleProps) {
  const { title, backButton } = props;
  const navigate = useNavigate();

  const handleClickBack = () => {
    navigate(-1);
  };

  return (
    <Box {...props} display={"flex"} gap={1} alignItems={"center"}>
      {backButton && (
        <IconButton onClick={handleClickBack}>
          <ArrowBackRoundedIcon />
        </IconButton>
      )}
      <Box fontSize={"1.25rem"}>{title}</Box>
    </Box>
  );
}
