import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
// import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";
import { Can } from "@shared/ability";
import { RedirectPath } from "@shared/enums.ts";
import { useStore } from "@shared/hooks";
import { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RpdListItem } from "../model/types.ts";
import RpdListItemComponent from "./RpdListItem.tsx";

interface RpdListProps {
  RpdListItems: RpdListItem[];
}

export const RpdList: FC<RpdListProps> = ({ RpdListItems }) => {
  const { jsonData, complectId } = useStore((state) => state);
  const navigate = useNavigate();
  const { id: templateId, page } = useParams();
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {jsonData?.disciplins_name && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel1-content">
            <Typography fontSize={"14px"} fontWeight={"bold"} color={"primary"}>
              {String(jsonData.disciplins_name)}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <ListItem disablePadding>
              <ListItemText>
                <Typography
                  fontSize={"14px"}
                  color="textSecondary"
                >{`${jsonData.direction}, ${jsonData.profile}`}</Typography>
              </ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemText>
                <Typography
                  fontSize={"14px"}
                  color="textSecondary"
                >{`Уровень образования - ${jsonData.education_level}`}</Typography>
              </ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemText>
                <Typography
                  fontSize={"14px"}
                  color="textSecondary"
                >{`Форма обучения - ${jsonData.education_form}`}</Typography>
              </ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemText>
                <Typography fontSize={"14px"} color="textSecondary">{`Год набора - ${jsonData.year}`}</Typography>
              </ListItemText>
            </ListItem>
          </AccordionDetails>
        </Accordion>
      )}
      <Box
        sx={{
          flex: 1,
          overflowY: "scroll",
          overflowX: "hidden",
          minHeight: 0,
          // scrollbarColor: "#bdbdbd #f5f5f5",
          // scrollbarWidth: "thin",
          // scrollbarGutter: "stable",
          "&::-webkit-scrollbar": {
            width: "8px",
            backgroundColor: "#f5f5f5",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#bdbdbd",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "#f5f5f5",
          },
        }}
      >
        <List dense disablePadding>
          {RpdListItems.map((item) => (
            <>
              {/* <Divider sx={{ bgcolor: "#ffffff", height: 0 }} /> */}
              <RpdListItemComponent item={item} templateId={templateId} templatePage={page} />
            </>
          ))}
          {/* <Divider sx={{ bgcolor: "#ffffff", height: 0 }} /> */}
        </List>
      </Box>
      <Box
        sx={{
          flexShrink: 0,
          width: "100%",
        }}
      >
        <Divider sx={{ bgcolor: "#ffffff", height: 0 }} />
        <List dense>
          <Can I="get" a="rop_interface">
            <ListItem disableGutters disablePadding>
              <ListItemButton
                onClick={() => navigate(`${RedirectPath.TEMPLATES}/${templateId}/${TemplatePagesPath.TEST_PDF}`)}
                sx={{ py: 1 }}
              >
                <ListItemIcon sx={{ pl: 2 }}>
                  <DescriptionIcon sx={{ fontSize: "20px" }} />
                </ListItemIcon>
                <ListItemText primary={<Typography fontSize={"14px"}>Сформировать документ</Typography>} />
              </ListItemButton>
            </ListItem>
          </Can>
          <ListItem disableGutters disablePadding>
            <ListItemButton onClick={() => navigate(`${RedirectPath.COMPLECTS}/${complectId}`)} sx={{ py: 1 }}>
              <ListItemIcon sx={{ pl: 2 }}>
                <ArrowBackIcon sx={{ fontSize: "20px" }} />
              </ListItemIcon>
              <ListItemText primary={<Typography fontSize={"14px"}>Список РПД</Typography>} />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );
};
