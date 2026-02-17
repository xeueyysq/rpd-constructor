import { Box, Typography as Tg } from "@mui/material";
import { useStore } from "@shared/hooks";
import { PageTitle } from "@shared/ui";
import { FC } from "react";

const CoverPage: FC = () => {
  const jsonData = useStore.getState().jsonData;

  return (
    <Box>
      <PageTitle title="Титульный лист" />
      <Tg sx={{ py: 2 }}>
        Федеральное государственное бюджетное образовательное учреждение высшего
        образования Университет «Дубна» (государственный университет «Дубна»)
      </Tg>
      <Tg sx={{ py: 2 }}>
        Институт системного анализа и управления
        <br />
      </Tg>
      <Tg sx={{ py: 2 }}>
        Кафедра распределенных информационно-вычислительных систем
        <br />
      </Tg>
      <Tg sx={{ py: 2 }}>
        Утверждаю <br />
        и.о. проректора по учебно-методической работе <br />
        __________________/ Анисимова О.В. <br />
        __________________202_ год <br />
      </Tg>
      <Tg sx={{ fontWeight: "600", py: 2 }}>Рабочая программа дисциплины</Tg>
      <Tg sx={{ p: 1, border: "1px dashed grey", my: 1 }}>
        <Tg sx={{ fontWeight: "600" }}>Название дисциплины</Tg>
        <Tg>{jsonData.disciplins_name}</Tg>
      </Tg>
      <Tg sx={{ p: 1, border: "1px dashed grey", my: 1 }}>
        <Tg sx={{ fontWeight: "600" }}>Направление подготовки</Tg>
        <Tg>{jsonData.direction}</Tg>
      </Tg>
      <Tg sx={{ p: 1, border: "1px dashed grey", my: 1 }}>
        <Tg sx={{ fontWeight: "600" }}>Профиль</Tg>
        <Tg>{jsonData.profile}</Tg>
      </Tg>
      <Tg sx={{ p: 1, border: "1px dashed grey", my: 1 }}>
        <Tg sx={{ fontWeight: "600" }}>Уровень высшего образования</Tg>
        <Tg>{jsonData.education_level}</Tg>
      </Tg>
      <Tg sx={{ p: 1, border: "1px dashed grey", my: 1 }}>
        <Tg sx={{ fontWeight: "600" }}>Форма обучения</Tg>
        <Tg>{jsonData.education_form}</Tg>
      </Tg>
      <Tg sx={{ p: 1, border: "1px dashed grey", my: 1 }}>
        <Tg sx={{ fontWeight: "600" }}>Год обучения</Tg>
        <Tg>{jsonData.year}</Tg>
      </Tg>
    </Box>
  );
};

export default CoverPage;
