import { FC, RefObject, useEffect, useRef, useState } from "react";
import { Editor as DraftEditor, EditorState } from "draft-js";
import { stateToHTML } from "draft-js-export-html";
import { stateFromHTML } from "draft-js-import-html";
import {
  Editor,
  isBold,
  toggleBold,
  isItalic,
  toggleItalic,
  isUnderline,
  toggleUnderline,
  getDefaultKeyBindingFn,
  shortcutHandler,
  isOL,
  isUL,
  toggleOL,
  toggleUL,
  focusOnEditor,
} from "contenido";

import { IconButton, Box, Button, ButtonGroup } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";

interface TestEditor {
  value: string;
  saveContent: (htmlValue: string, changed: boolean) => Promise<void>;
  setIsEditing: (value: boolean) => void;
  isComment?: boolean;
}

const TextEditor: FC<TestEditor> = ({
  value,
  saveContent,
  setIsEditing,
  isComment,
}) => {
  const [editorState, setEditorState] = useState(() =>
    EditorState.createWithContent(stateFromHTML(value))
  );
  const originalHtml = useRef(stateToHTML(editorState.getCurrentContent()));
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const editorRef = useRef<DraftEditor>(null);
  // contenido ожидает ненулевой ref, хотя React заполняет его только после монтирования.
  const contenidoEditorRef = editorRef as RefObject<DraftEditor>;

  useEffect(() => focusOnEditor(contenidoEditorRef), [contenidoEditorRef]);

  const handleSaveClick = async () => {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    try {
      const html = stateToHTML(editorState.getCurrentContent());
      await saveContent(html, html !== originalHtml.current);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  const toolbarButtons = [
    {
      name: "Bold",
      handler: toggleBold,
      detector: isBold,
      icon: <FormatBoldIcon />,
    },
    {
      name: "Italic",
      handler: toggleItalic,
      detector: isItalic,
      icon: <FormatItalicIcon />,
    },
    {
      name: "Underline",
      handler: toggleUnderline,
      detector: isUnderline,
      icon: <FormatUnderlinedIcon />,
    },
    {
      name: "Ordered List",
      handler: toggleOL,
      detector: isOL,
      icon: <FormatListNumberedIcon />,
    },
    {
      name: "Unordered List",
      handler: toggleUL,
      detector: isUL,
      icon: <FormatListBulletedIcon />,
    },
  ];

  return (
    <>
      <Box
        sx={(theme) => ({
          display: "inline-flex",
          border: 1,
          borderColor: "divider",
          borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`,
          mt: 2,
        })}
      >
        {toolbarButtons.map((btn) => (
          <IconButton
            key={btn.name}
            disabled={isSaving}
            onMouseDown={(e) => {
              e.preventDefault();
              btn.handler(editorState, setEditorState);
            }}
            sx={{
              color: btn.detector(editorState) ? "info.main" : "text.primary",
            }}
          >
            {btn.icon}
          </IconButton>
        ))}
      </Box>
      <Box
        sx={(theme) => ({
          gap: 4,
          p: 1,
          border: 1,
          borderColor: "divider",
          borderRadius: `0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px`,
          mb: 2,
          "& .public-DraftStyleDefault-block": {
            margin: theme.spacing(1.25, 0),
            textIndent: "1.5em",
            lineHeight: theme.typography.body1.lineHeight,
          },
          "& ol, ul": {
            paddingLeft: "1.5em",
          },
          "& .public-DraftStyleDefault-orderedListItem div": {
            margin: "0",
            textIndent: "0",
          },
          "& .public-DraftStyleDefault-unorderedListItem div": {
            margin: "0",
            textIndent: "0",
          },
        })}
        className="textEditor"
      >
        <Editor
          editorState={editorState}
          onChange={setEditorState}
          readOnly={isSaving}
          handleKeyCommand={shortcutHandler(setEditorState)}
          keyBindingFn={getDefaultKeyBindingFn}
          editorRef={contenidoEditorRef}
        />
      </Box>
      <ButtonGroup
        color={isComment ? "warning" : undefined}
        variant="outlined"
        disabled={isSaving}
      >
        <Button variant="contained" onClick={handleSaveClick}>
          {isComment ? "Сохранить комментарий" : "Сохранить изменения"}
        </Button>
        <Button variant="outlined" onClick={() => setIsEditing(false)}>
          Отменить
        </Button>
      </ButtonGroup>
    </>
  );
};

export default TextEditor;
