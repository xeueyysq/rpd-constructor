import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import AddBook from "../find-books/AddBook.tsx";
import { PageTitle } from "@shared/ui";

const ResourceSupportPage: FC = () => {
  return (
    <Box>
      <PageTitle title="Ресурсное обеспечение" />
      <Box component="h4" sx={{ pt: 2, pb: 1 }}>
        Перечень литературы
      </Box>

      <Box component="h4" sx={{ pt: 1 }}>
        Основная литература
      </Box>
      <AddBook elementName="textbook" />

      <Box component="h4" sx={{ pt: 1 }}>
        Дополнительная литература
      </Box>
      <AddBook elementName="additional_textbook" />

      <Box component="h4" sx={{ py: 1 }}>
        Профессиональные базы данных и информационные справочные системы
      </Box>
      <JsonChangeValue elementName="professional_information_resources" />

      <Box component="h4" sx={{ py: 1 }}>
        Необходимое программное обеспечение
      </Box>
      <JsonChangeValue elementName="software" />

      <Box component="h4" sx={{ py: 1 }}>
        Необходимое материально-техническое обеспечение
      </Box>
      <JsonChangeValue elementName="logistics_template" />
    </Box>
  );
};

export default ResourceSupportPage;
