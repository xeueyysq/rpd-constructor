import { Box, IconButton, BoxProps, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";

type PageTitleProps = BoxProps & {
  title: string;
  backNavPath?: string;
};

export function PageTitle(props: PageTitleProps) {
  const { title, backNavPath } = props;
  const navigate = useNavigate();

  return (
    <Box {...props} display={"flex"} gap={1} alignItems={"center"}>
      {backNavPath && (
        <IconButton onClick={() => navigate(backNavPath)}>
          <ArrowBackRoundedIcon />
        </IconButton>
      )}
      <Typography color={"primary"} fontSize={"1.25rem"} fontWeight={"bold"}>
        {title}
      </Typography>
    </Box>
  );
}
