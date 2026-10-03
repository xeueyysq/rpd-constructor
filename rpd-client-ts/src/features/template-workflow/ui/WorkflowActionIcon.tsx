import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import DoneOutlinedIcon from "@mui/icons-material/DoneOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import type { SvgIconComponent } from "@mui/icons-material";
import type { WorkflowAction } from "@entities/template";

const icons: Partial<Record<WorkflowAction, SvgIconComponent>> = {
  start: PlayArrowOutlinedIcon,
  finish: DoneOutlinedIcon,
  reopen: UndoOutlinedIcon,
  accept: TaskAltOutlinedIcon,
  refine: AssignmentReturnOutlinedIcon,
};

export function WorkflowActionIcon({ action }: { action: WorkflowAction }) {
  const Icon = icons[action];
  return Icon ? <Icon /> : null;
}
