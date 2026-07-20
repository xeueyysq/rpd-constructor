import { TableCell, TableRow } from "@mui/material";

export function DisciplineContentTableHeader() {
  return (
    <TableRow>
      <TableCell align="center" width="180px">
        Наименование разделов и тем дисциплины
      </TableCell>
      <TableCell align="center" width="90px" sx={{ minWidth: 90 }}>
        Всего (академ. часы)
      </TableCell>
      <TableCell align="center" width="90px" sx={{ minWidth: 90 }}>
        Лекции
      </TableCell>
      <TableCell align="center" width="140px" sx={{ minWidth: 140 }}>
        Практические (семинарские) занятия
      </TableCell>
      <TableCell align="center" width="100px" sx={{ minWidth: 100 }}>
        Контроль
      </TableCell>
      <TableCell align="center" width="130px" sx={{ minWidth: 130 }}>
        Всего часов контактной работы
      </TableCell>
      <TableCell align="center" width="160px" sx={{ minWidth: 160 }}>
        Самостоятельная работа обучающегося
      </TableCell>
    </TableRow>
  );
}
