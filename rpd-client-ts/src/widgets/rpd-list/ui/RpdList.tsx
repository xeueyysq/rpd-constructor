import {
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
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
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
    <>
      {jsonData?.disciplins_name && (
        <Box sx={{ py: 1 }}>
          <SimpleTreeView>
            <TreeItem
              itemId="disciplins_name"
              label={String(jsonData.disciplins_name)}
            >
              <TreeItem
                itemId="direction"
                label={`${jsonData.direction}, ${jsonData.profile}`}
                disabled
              />
              <TreeItem
                itemId="education_level"
                label={`Уровень образования - ${jsonData.education_level}`}
                disabled
              />
              <TreeItem
                itemId="education_form"
                label={`Форма обучения - ${jsonData.education_form}`}
                disabled
              />
              <TreeItem
                itemId="year"
                label={`Год набора - ${jsonData.year}`}
                disabled
              />
            </TreeItem>
          </SimpleTreeView>
        </Box>
      )}
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
      </List>
      <Divider sx={{ bgcolor: "#ffffff", height: 0 }} />
      <List dense>
        <Can I="get" a="rop_interface">
          <ListItem disableGutters sx={{ p: 0 }}>
            <ListItemButton
              onClick={() => setTemplatePage("testPdf")}
              sx={{ py: 1 }}
            >
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
            <ListItemText
              primary={<Typography>Вернуться к выбору шаблона</Typography>}
            />
          </ListItemButton>
        </ListItem>
      </List>
    </>
  );
};
