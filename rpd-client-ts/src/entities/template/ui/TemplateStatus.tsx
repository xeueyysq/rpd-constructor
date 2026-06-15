import { StatusWithDate } from "@shared/ui/StatusWithDate";
import { FC } from "react";
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
  const label =
    statusConfig[status.status as keyof typeof statusConfig]?.label ||
    status.status;

  return <StatusWithDate label={label} date={status.date} />;
};
