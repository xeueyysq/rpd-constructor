import { SourcePickerDialog } from "@features/template-import";

type Props = {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onImported: () => Promise<void> | void;
} & (
  | { targetTemplateId: number; targetComplectId?: never }
  | { targetComplectId: number | string; targetTemplateId?: never }
);

export function ImportFromComplectsDialog(props: Props) {
  return (
    <SourcePickerDialog
      key={props.targetTemplateId ?? props.targetComplectId}
      {...props}
    />
  );
}
