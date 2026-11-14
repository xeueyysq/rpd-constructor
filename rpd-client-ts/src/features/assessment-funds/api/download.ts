import { useMutation } from "@tanstack/react-query";
import { axiosBase } from "@shared/api";
import { filenameFromContentDisposition } from "@shared/lib";
import { useComplectCompetencies } from "@entities/rpd-complect";

export function useAssessmentFundsCompetencies(
  complectId: string,
  enabled: boolean
) {
  return useComplectCompetencies(complectId, enabled);
}

export function excelFilename(contentDisposition: unknown): string {
  return filenameFromContentDisposition(contentDisposition, "ФОС.xlsx");
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
