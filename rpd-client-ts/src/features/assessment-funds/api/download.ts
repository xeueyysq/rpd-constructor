import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosBase } from "@shared/api";

type ResultsRow = {
  competence: string;
  indicator: string;
  disciplines: string[];
};

export function useAssessmentFundsCompetencies(
  complectId: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["assessment-funds-competencies", complectId],
    queryFn: async () => {
      const { data } = await axiosBase.get<ResultsRow[]>("get-results-data", {
        params: { complectId },
      });
      return Array.isArray(data) ? data : [];
    },
    enabled,
  });
}

export function excelFilename(contentDisposition: unknown): string {
  if (typeof contentDisposition !== "string") return "ФОС.xlsx";
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (!encoded) return "ФОС.xlsx";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "ФОС.xlsx";
  }
}

export function useDownloadAssessmentFundsWord() {
  return useMutation({
    mutationFn: async ({
      complectId,
      competence,
    }: {
      complectId: string;
      competence: string;
    }) => {
      const response = await axiosBase.post<Blob>(
        "generate-assessment-funds-docx",
        { complectId, competence },
        { responseType: "blob" }
      );
      return response.data;
    },
  });
}

export function useDownloadAssessmentFundsExcel() {
  return useMutation({
    mutationFn: async (complectId: string) => {
      const response = await axiosBase.post<Blob>(
        "generate-assessment-funds-xlsx",
        { complectId },
        { responseType: "blob" }
      );
      return {
        blob: response.data,
        filename: excelFilename(response.headers["content-disposition"]),
      };
    },
  });
}
