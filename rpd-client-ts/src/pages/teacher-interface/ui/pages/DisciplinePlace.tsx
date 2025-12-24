import { useStore } from "@shared/hooks";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { Loader, PageTitle } from "@shared/ui";
import { FC } from "react";
import CertificationSelector from "../changeable-elements/CertificationSelector.tsx";
import { CommentChangeValue } from "../changeable-elements/CommentChangeValue.tsx";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";

const DisciplinePlace: FC = () => {
  const data = useStore((state) => state.jsonData);

  const placeWrapper = () => {
    if (data.place === "Обязательная часть") return "обязательной части";
    if (data.place) return String(data.place).toLowerCase();
    return "";
  };

  return (
    <Box>
      <PageTitle title="Место дисциплины в структуре ОПОП" paddingBottom={2} />
      <CommentChangeValue templateField={TemplatePagesPath.DISCIPLINE_PLACE} />
      {Object.keys(data).length ? (
        <Box sx={{ py: 2 }}>
          Дисциплина
          <Box component="span" sx={{ fontWeight: "600" }}>
            {" "}
            «{data.disciplins_name}»{" "}
          </Box>
          относится к
          <Box component="span" sx={{ fontWeight: "600" }}>
            {" "}
            {placeWrapper()}{" "}
          </Box>
          учебного плана направления
          <Box component="span" sx={{ fontWeight: "600" }}>
            {" "}
            «{data.direction}»{" "}
          </Box>
          . Дисциплина преподается в
          <Box component="span" sx={{ fontWeight: "600" }}>
            {" "}
            {data.semester}{" "}
          </Box>
          семестре, на
          <Box component="span" sx={{ fontWeight: "600" }}>
            {" "}
            {Math.ceil(Number(data.semester) / 2)}{" "}
          </Box>
          курсе
          <Box sx={{ pt: 2 }}>
            {!data.certification && (
              <Box sx={{ color: "warning.main", fontWeight: 600, mb: 1 }}>
                Форма промежуточной аттестации не подгрузилась из 1С — выберите вручную.
              </Box>
            )}
            форма промежуточной аттестации – <CertificationSelector certification={data.certification || ""} />
          </Box>
        </Box>
      ) : (
        <Loader />
      )}
      <JsonChangeValue elementName="place_more_text" />
    </Box>
  );
};

export default DisciplinePlace;
