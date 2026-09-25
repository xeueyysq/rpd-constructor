import { Box, Typography as Tg } from "@mui/material";
import { TemplatePagesPath } from "@shared/enums";
import { PageTitleComment } from "../PageTitleComment";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import AddBook from "../find-books/AddBook.tsx";

function ResourceSupportPage() {
  return (
    <Box>
      <PageTitleComment
        title="Ресурсное обеспечение"
        sx={{ pb: 2 }}
        templateField={TemplatePagesPath.RESOURCE_SUPPORT}
      />
      <Tg sx={{ fontWeight: "bold", pt: 2, pb: 1 }}>Перечень литературы</Tg>

      <Tg sx={{ fontWeight: "bold", pt: 1 }}>Основная литература</Tg>
      <AddBook elementName="textbook" />

      <Tg sx={{ fontWeight: "bold", pt: 1 }}>Дополнительная литература</Tg>
      <AddBook elementName="additional_textbook" />

      <Tg sx={{ fontWeight: "bold", py: 1 }}>
        Профессиональные базы данных и информационные справочные системы
      </Tg>
      <JsonChangeValue elementName="professional_information_resources" />

      <Tg sx={{ fontWeight: "bold", py: 1 }}>
        Необходимое программное обеспечение
      </Tg>
      <JsonChangeValue elementName="software" />

      <Tg sx={{ fontWeight: "bold", py: 1 }}>
        Необходимое материально-техническое обеспечение
      </Tg>
      <JsonChangeValue elementName="logistics_template" />
    </Box>
  );
}

export default ResourceSupportPage;
