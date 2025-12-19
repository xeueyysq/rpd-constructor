import { Box } from "@mui/material";
import { FC } from "react";
import { useStore } from "@shared/hooks";
import { PageTitle } from "@shared/ui";

const ScopeDisciplinePage: FC = () => {
  const jsonData = useStore.getState().jsonData;
  const summHours = () => {
    if (!Array.isArray(jsonData.study_load)) return "?";
    let summ = 0;
    for (const value of jsonData.study_load) {
      summ += Number(value.id);
    }
    return summ;
  };

  return (
    <Box>
      <PageTitle title="Объем дисциплины" />
      <Box sx={{ py: 2 }}>
        Объем дисциплины составляет
        <Box component="span" sx={{ fontWeight: "600" }}>
          {" "}
          {jsonData.zet || ""}{" "}
        </Box>
        зачетных единиц, всего
        <Box component="span" sx={{ fontWeight: "600" }}>
          {" "}
          {summHours() || ""}{" "}
        </Box>
        академических часа(ов)
      </Box>
    </Box>
  );
};

export default ScopeDisciplinePage;
