import { Box, IconButton, BoxProps, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";

type PageTitleProps = BoxProps & {
  title: string;
  backNavPath?: string;
};

export function PageTitle(props: PageTitleProps) {
  const { title, backNavPath, sx, ...boxProps } = props;
  const navigate = useNavigate();

  return (
    <Box
      {...boxProps}
      sx={[
        { display: "flex", gap: 1, alignItems: "center" },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {backNavPath && (
        <IconButton onClick={() => navigate(backNavPath)}>
          <ArrowBackRoundedIcon />
        </IconButton>
      )}
      <Typography
        sx={{ fontSize: "1.25rem", fontWeight: "bold" }}
        color={"primary"}
      >
        {title}
      </Typography>
    </Box>
  );
}
