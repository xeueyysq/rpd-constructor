import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { UserRole } from "@shared/ability";
import { getSessionGeneration } from "@shared/api";
import {
  captureRuntimeError,
  setDiagnosticEntity,
  setDiagnosticRoles,
  setDiagnosticRoute,
  setDiagnosticSender,
  setFeedbackAvailable,
} from "@shared/diagnostics";
import { useAuth } from "@entities/auth";
import { sendDiagnosticEvent, useFeedbackConfig } from "@entities/feedback";
import { useStore } from "@shared/hooks";

export function DiagnosticsSessionBridge() {
  const primaryRole = useAuth((state) => state.primaryRole);
  const activeRole = useAuth((state) => state.userRole);
  const config = useFeedbackConfig(primaryRole !== UserRole.ANONYMOUS);

  useLayoutEffect(() => {
    setDiagnosticRoles(
      String(primaryRole),
      String(activeRole),
      getSessionGeneration()
    );
  }, [primaryRole, activeRole]);

  useEffect(() => {
    setDiagnosticSender(sendDiagnosticEvent);
    const onError = (event: ErrorEvent) => {
      if (event.error instanceof Error) captureRuntimeError(event.error);
    };
    const onRejection = (event: PromiseRejectionEvent) =>
      captureRuntimeError(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      setDiagnosticSender(undefined);
    };
  }, []);

  useEffect(() => {
    if (config.data)
      setFeedbackAvailable(config.data.enabled, getSessionGeneration());
  }, [config.data]);
  return null;
}

export function DiagnosticsRouteBridge() {
  const location = useLocation();
  useLayoutEffect(() => {
    setDiagnosticRoute(location.pathname, getSessionGeneration());
  }, [location.pathname]);
  useEffect(() => {
    if (location.pathname !== "/manager") return;
    const generation = getSessionGeneration();
    const updateSelection = () => {
      const { managerPage, selectedTemplateData: selected } =
        useStore.getState();
      const visible = managerPage !== "selectData";
      setDiagnosticEntity(
        {
          faculty: visible ? selected.faculty : undefined,
          direction: visible ? selected.directionOfStudy : undefined,
          profile: visible ? selected.profile : undefined,
          form: visible ? selected.formEducation : undefined,
          year: visible ? selected.year : undefined,
        },
        location.pathname,
        generation
      );
    };
    updateSelection();
    return useStore.subscribe((next, previous) => {
      if (
        next.selectedTemplateData !== previous.selectedTemplateData ||
        next.managerPage !== previous.managerPage
      )
        updateSelection();
    });
  }, [location.pathname]);
  return null;
}
