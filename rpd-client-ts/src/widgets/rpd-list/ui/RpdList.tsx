import {
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
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import RpdListItemComponent from "./RpdListItem.tsx";
import { FC } from "react";
import { RpdListItem } from "../model/types.ts";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
// import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import { useStore } from "@shared/hooks";
import { Can } from "@shared/ability";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

interface RpdListProps {
  RpdListItems: RpdListItem[];
  setChoise: (choise: string) => void;
}

export const RpdList: FC<RpdListProps> = ({ RpdListItems }) => {
  const jsonData = useStore.getState().jsonData;
  const navigate = useNavigate();
  const { setTemplatePage, templatePage } = useStore();
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
        <Box pt={1}>
          <SimpleTreeView>
            <TreeItem itemId="disciplins_name" label={String(jsonData.disciplins_name)}>
              <TreeItem
                itemId="direction"
                label={`${jsonData.direction}, ${jsonData.profile}`}
                sx={{ color: alpha("#000000", 0.5) }}
              />
              <TreeItem
                itemId="education_level"
                label={`Уровень образования - ${jsonData.education_level}`}
                sx={{ color: alpha("#000000", 0.5) }}
              />
              <TreeItem
                itemId="education_form"
                label={`Форма обучения - ${jsonData.education_form}`}
                sx={{ color: alpha("#000000", 0.5) }}
              />
              <TreeItem itemId="year" label={`Год набора - ${jsonData.year}`} sx={{ color: alpha("#000000", 0.5) }} />
            </TreeItem>
          </SimpleTreeView>
        </Box>
      )}
      <Box
        sx={{
          flex: 1,
          overflowY: "scroll",
          overflowX: "hidden",
          minHeight: 0,
          scrollbarColor: "#bdbdbd #f5f5f5",
          scrollbarWidth: "thin",
          scrollbarGutter: "stable",
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
        <List dense>
          {RpdListItems.map((item) => (
            <>
              <Divider sx={{ bgcolor: "#ffffff", height: 0 }} />
              <RpdListItemComponent
                setChoise={setTemplatePage}
                key={item.id}
                id={item.id}
                text={item.text}
                activePage={templatePage}
              />
            </>
          ))}
          <Divider sx={{ bgcolor: "#ffffff", height: 0 }} />
        </List>
      </Box>
      <Box
        sx={{
          backgroundColor: "background.paper",
          flexShrink: 0,
          width: "100%",
        }}
      >
        <Divider sx={{ bgcolor: "#ffffff", height: 0 }} />
        <List dense>
          <Can I="get" a="rop_interface">
            <ListItem disableGutters sx={{ p: 0 }}>
              <ListItemButton onClick={() => setTemplatePage("testPdf")} sx={{ py: 1 }}>
                <ListItemIcon sx={{ pl: 2 }}>
                  <PictureAsPdfIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      style={{
                        color: "black",
                        fontFamily: "Arial",
                        fontSize: "16px",
                      }}
                    >
                      Сформировать документ
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          </Can>
          <ListItem disableGutters sx={{ p: 0 }}>
            <ListItemButton onClick={() => navigate(-1)} sx={{ py: 1 }}>
              <ListItemIcon sx={{ pl: 2 }}>
                <ArrowBackIcon />
              </ListItemIcon>
              <ListItemText primary={<Typography>Список РПД</Typography>} />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );
};
