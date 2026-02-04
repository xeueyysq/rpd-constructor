import { TemplateConstructorType } from "@entities/template";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Loader } from "@shared/ui";
import { AxiosError, isAxiosError } from "axios";
import { FC, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { templateDataTitles } from "../model/templateDataTitles.ts";
import { RedirectPath } from "@shared/enums.ts";

export const TemplateConstructor: FC<TemplateConstructorType> = ({ setChoise }) => {
  const selectedTemplateData = useStore.getState().selectedTemplateData;
  const { setComplectId, complectId } = useStore();
  const [createComplectStatus, setCreateComplectStatus] = useState<string>("pending");
  const [isFindComplect, setIsFindComplect] = useState<boolean | undefined>(undefined);
  const navigate = useNavigate();

  const createRpdComplect = async () => {
    try {
      setCreateComplectStatus("loading");
      const response = await axiosBase.post("create_rpd_complect", {
        data: selectedTemplateData,
      });
      setComplectId(response.data);
      setCreateComplectStatus("success");
      showSuccessMessage("Комплект РПД создан успешно");
    } catch (error) {
      if (isAxiosError(error)) {
        if ((error as AxiosError).status === 422) {
          setCreateComplectStatus("warning");
          return;
        }
        showErrorMessage("Ошибка при создании комплекта РПД");
      } else {
        showErrorMessage("Неизвестная ошибка");
      }
      setCreateComplectStatus("error");
      console.error(error);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const response = await axiosBase.post("find_rpd_complect", {
        data: selectedTemplateData,
      });
      if (response.data === "NotFound") {
        setIsFindComplect(false);
        setCreateComplectStatus("pending");
      } else {
        setIsFindComplect(true);
        setComplectId(response.data.id);
      }
    } catch (error) {
      showErrorMessage("Ошибка поиска комплекта");
      console.error(error);
    }
  }, [selectedTemplateData, setComplectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function BackButton({ text }: { text: string }) {
    return (
      <Button sx={{ mr: 1 }} variant="outlined" onClick={() => setChoise("selectData")}>
        {text}
      </Button>
    );
  }

  return (
    <>
      <Typography sx={{ py: 2, fontSize: "18px", fontWeight: "600" }}>Выбранные данные:</Typography>
      {Object.entries(selectedTemplateData).map(([key, value]) => (
        <Box sx={{ pl: "40px" }} key={key}>
          <Typography component="span" sx={{ fontWeight: "600" }}>
            {templateDataTitles[key]}:{" "}
          </Typography>
          {value ? value : "Данные не найдены"}
        </Box>
      ))}
      {isFindComplect === undefined ? (
        <Loader />
      ) : (
        <>
          {!isFindComplect ? (
            <Box sx={{ py: 2 }}>
              {createComplectStatus === "pending" && (
                <Box>
                  <Typography color={"warning"} pb={2}>
                    Пожалуйста, проверьте данные комплекта РПД
                  </Typography>
                  <BackButton text="Назад" />
                  <Button variant="contained" onClick={createRpdComplect}>
                    Создать комплект
                  </Button>
                </Box>
              )}
              {createComplectStatus === "loading" && (
                <Box sx={{ p: 1, display: "flex" }}>
                  <CircularProgress color="inherit" size="1rem" />
                  <Typography sx={{ px: 1 }}>Идет поиск комплекта РПД. Это может занять какое-то время</Typography>
                </Box>
              )}
              {createComplectStatus === "warning" && (
                <Typography color={"warning"}>По заданному комплекту нет данных</Typography>
              )}
              {createComplectStatus === "error" && (
                <Typography color={"error"}>Сервис 1С временно недоступен</Typography>
              )}
              {createComplectStatus === "success" && (
                <Box>
                  <Typography pb={2}>Комплект РПД создан успешно. Перейти к редактированию?</Typography>
                  <BackButton text="Назад" />
                  <Button variant="contained" onClick={() => navigate(`${RedirectPath.COMPLECTS}/${complectId}`)}>
                    Перейти
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Typography sx={{ py: 2 }} fontWeight={"bold"} color={"success"}>
              Комплект РПД успешно найден
            </Typography>
          )}
        </>
      )}
      <Box display="flex" gap={3}>
        {isFindComplect && (
          <Box>
            <BackButton text="Назад" />
            <Button variant="contained" onClick={() => navigate(`${RedirectPath.COMPLECTS}/${complectId}`)}>
              Перейти к редактированию
            </Button>
          </Box>
        )}
      </Box>
    </>
  );
};
