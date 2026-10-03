import { formatStatusDate } from "@shared/lib/formatStatusDate";
import {
  StatusWithSubtext,
  type StatusWithSubtextProps,
} from "./StatusWithSubtext";

type StatusWithDateProps = Omit<StatusWithSubtextProps, "subtext"> & {
  date?: string | null;
};

export function StatusWithDate({ date, ...props }: StatusWithDateProps) {
  return <StatusWithSubtext {...props} subtext={formatStatusDate(date)} />;
}
