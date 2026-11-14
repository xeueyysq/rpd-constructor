import { SourcePickerDialog } from "@features/template-import";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  freezeDiagnosticContext,
  safeEntityContext,
  setDiagnosticEntity,
} from "@shared/diagnostics";

type Props = {
  open: boolean;
  targetLabel: string;
  discipline?: string;
  onClose: () => void;
  onImported: () => Promise<void> | void;
} & (
  | { targetTemplateId: number; targetComplectId?: never }
  | { targetComplectId: number | string; targetTemplateId?: never }
);

export function ImportFromComplectsDialog(props: Props) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!props.open || props.targetTemplateId == null || !props.discipline)
      return;
    const previous = freezeDiagnosticContext();
    setDiagnosticEntity(
      {
        ...safeEntityContext(previous.context),
        templateId: props.targetTemplateId,
        discipline: props.discipline,
        section: "Импорт РПД",
      },
      pathname,
      previous.generation
    );
    return () =>
      setDiagnosticEntity(
        safeEntityContext(previous.context),
        pathname,
        previous.generation
      );
  }, [props.open, props.targetTemplateId, props.discipline, pathname]);
  return (
    <SourcePickerDialog
      key={props.targetTemplateId ?? props.targetComplectId}
      {...props}
    />
  );
}
