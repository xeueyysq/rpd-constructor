import { Box } from "@mui/material";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import {
  downloadBlob,
  filenameFromContentDisposition,
  showErrorMessage,
} from "@shared/lib";
import { Loader } from "@shared/ui/Loader.tsx";
import { useEffect, useState } from "react";
import { PdfReader } from "./PdfReader.tsx";

export default function TestPdf() {
  const [fileName, setFileName] = useState<Blob | MediaSource | undefined>(
    undefined
  );
  const [pdfDownloadName, setPdfDownloadName] = useState("РПД.pdf");
  const [isLoading, setIsLoading] = useState(false);
  const [isWordLoading, setIsWordLoading] = useState(false);

  const loadPdfFile = async () => {
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
      setPdfDownloadName(
        filenameFromContentDisposition(
          response.headers["content-disposition"],
          "РПД.pdf"
        )
      );
    } catch (error) {
      showErrorMessage(
        "Произошла ошибка при формировании PDF файла. Пожалуйста, проверьте корректность введенных данных"
      );
      console.error(error);
    }
  };

  useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      await loadPdfFile();
      setIsLoading(false);
    };
    loadPdf();
  }, []);

  const downloadWord = async () => {
    const { id } = useStore.getState().jsonData;

    setIsWordLoading(true);
    try {
      const response = await axiosBase.get("generate-docx", {
        responseType: "blob",
        params: { id },
      });

      downloadBlob(
        response.data,
        filenameFromContentDisposition(
          response.headers["content-disposition"],
          "РПД.docx"
        )
      );
    } catch (error) {
      showErrorMessage(
        "Произошла ошибка при формировании Word файла. Пожалуйста, проверьте корректность введенных данных"
      );
      console.error(error);
    } finally {
      setIsWordLoading(false);
    }
  };

  if (isLoading) return <Loader />;

  return (
    <Box>
      {fileName && (
        <PdfReader
          file={fileName}
          downloadFilename={pdfDownloadName}
          onDownloadWord={downloadWord}
          isWordLoading={isWordLoading}
        />
      )}
    </Box>
  );
}
