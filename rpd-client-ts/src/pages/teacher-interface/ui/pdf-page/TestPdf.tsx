import { Box } from "@mui/material";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import { Loader } from "@shared/ui/Loader.tsx";
import { useEffect, useState } from "react";
import { PdfReader } from "./PdfReader.tsx";

export default function TestPdf() {
  const [fileName, setFileName] = useState<Blob | MediaSource | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      await TestPdf();
      setIsLoading(false);
    };
    loadPdf();
  }, []);

  const TestPdf = async () => {
    const id = useStore.getState().jsonData.id;

    const params = {
      id: id,
    };

    try {
      const response = await axiosBase.get("generate-pdf", {
        responseType: "blob",
        params,
      });
      setFileName(response.data);
    } catch (error) {
      showErrorMessage(
        "Произошла ошибка при формировании PDF файла. Пожалуйста, проверьте корректность введенных данных"
      );
      console.error(error);
    }
  };

  if (isLoading) return <Loader />;

  return <Box>{fileName && <PdfReader file={fileName} />}</Box>;
}
