import { FC, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@shared/hooks";
import { Box, Button, ButtonBaseProps, CircularProgress } from "@mui/material";
import { TemplateConstructorType } from "@entities/template";
import { templateDataTitles } from "../model/templateDataTitles.ts";
import { Loader } from "@shared/ui";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { isAxiosError } from "axios";

export const TemplateConstructor: FC<TemplateConstructorType> = ({ setChoise }) => {
  const selectedTemplateData = useStore.getState().selectedTemplateData;
  const { setComplectId } = useStore();
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
      setCreateComplectStatus("error");
      if (isAxiosError(error)) {
        showErrorMessage("Ошибка при создании комплекта РПД");
      } else {
        showErrorMessage("Неизвестная ошибка");
      }
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

  const hashFragment = `${selectedTemplateData.profile} ${selectedTemplateData.year}`;

  return (
    <>
      <Box sx={{ py: 2, fontSize: "18px", fontWeight: "600" }}>Выбранные данные:</Box>
      {Object.entries(selectedTemplateData).map(([key, value]) => (
        <Box sx={{ pl: "40px" }} key={key}>
          <Box component="span" sx={{ fontWeight: "600" }}>
            {templateDataTitles[key]}:{" "}
          </Box>
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
                  <Box color={"orange"} fontWeight={"bold"} pb={2}>
                    Пожалуйста, проверьте данные комплекта РПД
                  </Box>
                  <BackButton text="Назад" />
                  <Button variant="contained" onClick={() => createRpdComplect()}>
                    Создать комплект
                  </Button>
                </Box>
              )}
              {createComplectStatus === "loading" && (
                <Box sx={{ p: 1, display: "flex" }}>
                  <CircularProgress color="inherit" size="1rem" />
                  <Box sx={{ px: 1 }}>Идет поиск комплекта РПД. Это может занять какое-то время</Box>
                </Box>
              )}
              {createComplectStatus === "error" && <Box color={"red"}>Сервис 1С временно недоступен</Box>}
              {createComplectStatus === "success" && (
                <Box>
                  <Box pb={2}>Комплект РПД создан успешно. Перейти к редактированию?</Box>
                  <BackButton text="Назад" />
                  <Button
                    variant="contained"
                    onClick={() => navigate(`/complects#${encodeURIComponent(hashFragment)}`)}
                  >
                    Перейти
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ py: 2 }} fontWeight={"bold"} color={"green"}>
              Комплект РПД успешно найден
            </Box>
          )}
        </>
      )}
      <Box display="flex" gap={3}>
        {isFindComplect && (
          <Box>
            <BackButton text="Назад" />
            <Button variant="contained" onClick={() => navigate(`/complects#${encodeURIComponent(hashFragment)}`)}>
              Перейти к редактированию
            </Button>
          </Box>
        )}
      </Box>
    </>
  );
};
