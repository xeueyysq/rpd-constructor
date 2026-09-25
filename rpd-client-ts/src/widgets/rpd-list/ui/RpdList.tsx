import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { Can } from "@shared/ability";
import { RedirectPath, TemplatePagesPath } from "@shared/enums";
import { useStore } from "@shared/hooks";
import { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RpdListItem, RpdSelectionItem } from "../model/types.ts";
import RpdListItemComponent from "./RpdListItem.tsx";

type RpdListProps =
  | { RpdListItems: RpdListItem[]; setChoise?: never; selectedId?: never }
  | {
      RpdListItems: RpdSelectionItem[];
      setChoise: (id: string) => void;
      selectedId: string;
    };

export const RpdList: FC<RpdListProps> = (props) => {
  const { RpdListItems } = props;
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
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1-content"
          >
            <Typography
              sx={{ fontSize: "14px", fontWeight: "bold" }}
              color={"primary"}
            >
              {String(jsonData.disciplins_name)}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <ListItem disablePadding>
              <ListItemText>
                <Typography
                  sx={{ fontSize: "14px" }}
                  color="textSecondary"
                >{`${jsonData.direction}, ${jsonData.profile}`}</Typography>
              </ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemText>
                <Typography
                  sx={{ fontSize: "14px" }}
                  color="textSecondary"
                >{`Уровень образования - ${jsonData.education_level}`}</Typography>
              </ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemText>
                <Typography
                  sx={{ fontSize: "14px" }}
                  color="textSecondary"
                >{`Форма обучения - ${jsonData.education_form}`}</Typography>
              </ListItemText>
            </ListItem>
            <ListItem disablePadding>
              <ListItemText>
                <Typography
                  sx={{ fontSize: "14px" }}
                  color="textSecondary"
                >{`Год набора - ${jsonData.year}`}</Typography>
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
          {RpdListItems.map((item) =>
            props.setChoise ? (
              <RpdListItemComponent
                key={item.id}
                item={item}
                onSelect={props.setChoise}
                selectedId={props.selectedId}
              />
            ) : "path" in item ? (
              <RpdListItemComponent
                key={item.id}
                item={item}
                templateId={templateId}
                templatePage={page}
              />
            ) : null
          )}
        </List>
      </Box>
      {!props.setChoise && (
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
                  onClick={() =>
                    navigate(
                      `${RedirectPath.TEMPLATES}/${templateId}/${TemplatePagesPath.TEST_PDF}`
                    )
                  }
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ pl: 2 }}>
                    <DescriptionIcon sx={{ fontSize: "20px" }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: "14px" }}>
                        Сформировать документ
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            </Can>
            <ListItem disableGutters disablePadding>
              <ListItemButton
                onClick={() =>
                  navigate(
                    `${RedirectPath.COMPLECTS}/${jsonData?.complect_uuid ?? complectId}`
                  )
                }
                sx={{ py: 1 }}
              >
                <ListItemIcon sx={{ pl: 2 }}>
                  <ArrowBackIcon sx={{ fontSize: "20px" }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: "14px" }}>
                      Список РПД
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      )}
    </Box>
  );
};
