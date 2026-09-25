import { StatusWithDate } from "@shared/ui/StatusWithDate";
import { FC } from "react";
import { getTemplateStatusLabel } from "../lib/getTemplateStatusLabel";

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

  const label = getTemplateStatusLabel(status.status);

  return <StatusWithDate label={label} date={status.date} />;
};
