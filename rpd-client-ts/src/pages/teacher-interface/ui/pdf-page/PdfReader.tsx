import { FC, useEffect, useState } from "react";
import { Document, Page } from "react-pdf";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "@mui/icons-material";

// Используем локальный worker из папки public
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

interface PdfReaderProps {
  file: Blob | MediaSource;
}

export const PdfReader: FC<PdfReaderProps> = ({ file }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [fileUrl, setFileUrl] = useState("");
  const [scale, setScale] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      try {
        const newFileUrl = URL.createObjectURL(file);
        setFileUrl(newFileUrl);
        setError(null);
        return () => {
          URL.revokeObjectURL(newFileUrl);
        };
      } catch (err) {
        setError("Ошибка при создании URL для PDF файла");
        console.error("Error creating URL:", err);
      }
    }
  }, [file]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    setError("Ошибка при загрузке PDF файла");
    console.error("Error loading PDF:", err);
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset;
      return Math.min(Math.max(1, newPageNumber), numPages);
    });
  };

  const handleZoom = (delta: number) => {
    setScale((prevScale) => {
      const newScale = prevScale + delta;
      return Math.min(Math.max(0.5, newScale), 2);
    });
  };

  if (!file) {
    return <Typography>No file is selected yet</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => handleZoom(-0.1)}>
          <ZoomOut />
        </IconButton>
        <Typography sx={{ minWidth: 100 }}>
          Zoom: {Math.round(scale * 100)}%
        </Typography>
        <IconButton onClick={() => handleZoom(0.1)}>
          <ZoomIn />
        </IconButton>
      </Stack>

      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={<Typography>Загрузка PDF...</Typography>}
      >
        <Page
          pageNumber={pageNumber}
          scale={scale}
          loading={<Typography>Загрузка страницы...</Typography>}
          error={
            <Typography color="error">Ошибка при загрузке страницы</Typography>
          }
        />
      </Document>

      {numPages > 0 && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          <IconButton onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
            <ChevronLeft />
          </IconButton>

          <Typography>
            Page {pageNumber} of {numPages}
          </Typography>

          <IconButton
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
};
