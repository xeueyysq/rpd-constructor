import { StatusWithDate } from "@shared/ui/StatusWithDate";
import { FC } from "react";
import { statusConfig } from "../model/templateStatusCodes";

interface TemplateStatusObject {
  date: string;
  status: string;
  user: string;
}

type TemplateStatusProps = {
  status: TemplateStatusObject | null | undefined;
};

export const TemplateStatus: FC<TemplateStatusProps> = ({ status }) => {
  if (!status) return null;

  const label =
    statusConfig[status.status as keyof typeof statusConfig]?.label ||
    status.status;

  return <StatusWithDate label={label} date={status.date} />;
};
