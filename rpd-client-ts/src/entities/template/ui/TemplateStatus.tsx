import { Box } from "@mui/material";
import { FC } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { statusConfig } from "../model/templateStatusCodes";

interface TemplateStatusObject {
  date: string;
  status: string;
  user: string;
}

type TemplateStatus = {
  status: TemplateStatusObject;
};

export const TemplateStatus: FC<TemplateStatus> = ({ status }) => {
  const formattedDate = format(parseISO(status.date), "d MMMM yyyy, HH:mm", {
    locale: ru,
  });
  return (
    <Box>
      <Box>{statusConfig[status.status as keyof typeof statusConfig]?.label || status.status}</Box>
      <Box
        sx={{
          color: "grey",
          fontSize: "12px",
        }}
      >
        {formattedDate}
      </Box>
    </Box>
  );
};
