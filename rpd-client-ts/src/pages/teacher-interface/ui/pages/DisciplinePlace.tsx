import { Box, Typography as Tg } from "@mui/material";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";
import { useStore } from "@shared/hooks";
import { Loader, PageTitleComment } from "@shared/ui";
import { FC } from "react";
import CertificationSelector from "../changeable-elements/CertificationSelector.tsx";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";

const DisciplinePlace: FC = () => {
  const data = useStore((state) => state.jsonData);

  const placeWrapper = () => {
    if (data.place === "Обязательная часть") return "обязательной части";
    if (data.place) return String(data.place).toLowerCase();
    return "";
  };

  return (
    <Box>
      <PageTitleComment
        title="Место дисциплины в структуре ОПОП"
        paddingBottom={2}
        templateField={TemplatePagesPath.DISCIPLINE_PLACE}
      />
      {Object.keys(data).length ? (
        <Tg sx={{ py: 2 }}>
          Дисциплина
          <Tg component="span" sx={{ fontWeight: "600" }}>
            {" "}
            «{data.disciplins_name}»{" "}
          </Tg>
          относится к
          <Tg component="span" sx={{ fontWeight: "600" }}>
            {" "}
            {placeWrapper()}{" "}
          </Tg>
          учебного плана направления
          <Tg component="span" sx={{ fontWeight: "600" }}>
            {" "}
            «{data.direction}»{" "}
          </Tg>
          . Дисциплина преподается в
          <Tg component="span" sx={{ fontWeight: "600" }}>
            {" "}
            {data.semester}{" "}
          </Tg>
          семестре, на
          <Tg component="span" sx={{ fontWeight: "600" }}>
            {" "}
            {Math.ceil(Number(data.semester) / 2)}{" "}
          </Tg>
          курсе
          <Tg sx={{ pt: 2 }}>
            форма промежуточной аттестации –{" "}
            <CertificationSelector certification={data.certification || ""} />
            {!data.certification && (
              <Tg sx={{ color: "warning.main", fontWeight: 600, mt: 1 }}>
                Форма промежуточной аттестации не подгрузилась из 1С — выберите
                вручную
              </Tg>
            )}
          </Tg>
        </Tg>
      ) : (
        <Loader />
      )}
      <JsonChangeValue elementName="place_more_text" />
    </Box>
  );
};

export default DisciplinePlace;
