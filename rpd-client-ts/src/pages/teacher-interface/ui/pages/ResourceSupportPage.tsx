import { Box, Typography as Tg } from "@mui/material";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";
import { PageTitleComment } from "@shared/ui";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import AddBook from "../find-books/AddBook.tsx";

function ResourceSupportPage() {
  return (
    <Box>
      <PageTitleComment
        title="Ресурсное обеспечение"
        paddingBottom={2}
        templateField={TemplatePagesPath.RESOURCE_SUPPORT}
      />
      <Tg fontWeight={"bold"} sx={{ pt: 2, pb: 1 }}>
        Перечень литературы
      </Tg>

      <Tg fontWeight={"bold"} sx={{ pt: 1 }}>
        Основная литература
      </Tg>
      <AddBook elementName="textbook" />

      <Tg fontWeight={"bold"} sx={{ pt: 1 }}>
        Дополнительная литература
      </Tg>
      <AddBook elementName="additional_textbook" />

      <Tg fontWeight={"bold"} sx={{ py: 1 }}>
        Профессиональные базы данных и информационные справочные системы
      </Tg>
      <JsonChangeValue elementName="professional_information_resources" />

      <Tg fontWeight={"bold"} sx={{ py: 1 }}>
        Необходимое программное обеспечение
      </Tg>
      <JsonChangeValue elementName="software" />

      <Tg fontWeight={"bold"} sx={{ py: 1 }}>
        Необходимое материально-техническое обеспечение
      </Tg>
      <JsonChangeValue elementName="logistics_template" />
    </Box>
  );
}

export default ResourceSupportPage;
