import { Box, Typography } from "@mui/material";
import { FC } from "react";
import { formatStatusDate } from "@shared/lib/formatStatusDate";

type StatusWithDateProps = {
  label: string;
  date?: string | null;
};

export const StatusWithDate: FC<StatusWithDateProps> = ({ label, date }) => {
  const formattedDate = formatStatusDate(date);

  return (
    <Box>
      <Box>{label}</Box>
      {formattedDate ? (
        <Typography sx={{ color: "grey", fontSize: "12px" }}>
          {formattedDate}
        </Typography>
      ) : null}
    </Box>
  );
};
