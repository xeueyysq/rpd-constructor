import { ChangeEvent, FC, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  TextField,
} from "@mui/material";
import { useStore } from "@shared/hooks";
import { useUpdateTemplateField } from "@entities/template";
import { bookSearchError, useFindBooks } from "../../api/findBooks";
import { addBooks } from "../../lib/bookList";
import { BooksMetaList } from "./BooksMetaList.tsx";
import { motion } from "framer-motion";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";

interface AddBook {
  elementName: string;
}

const AddBook: FC<AddBook> = ({ elementName }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [bookName, setBookName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");
  const findBooks = useFindBooks();
  const booksData = findBooks.data?.books;

  const elementValue = useStore((state) => state.jsonData[elementName]) as
    string[] | undefined;
  const updateJsonData = useStore((state) => state.updateJsonData);
  const save = useUpdateTemplateField();

  const saveBooks = (next: string[]) => {
    updateJsonData(elementName, next);
    void save(elementName, next);
  };

  const handleOpenDialog = () => {
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setErrorMessage(null);
    setBookName("");
    findBooks.reset();
  };

  const handleBookNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBookName(event.target.value);
    setErrorMessage(null);
    findBooks.reset();
  };

  const handleFindBooks = () => {
    const query = bookName.trim();
    if (!query) {
      setErrorMessage("Введите запрос для поиска");
      findBooks.reset();
      return;
    }
    setErrorMessage(null);
    findBooks.mutate(query);
  };

  const handleAddBooksToList = (biblios: string[]) => {
    const current =
      (useStore.getState().jsonData[elementName] as string[] | undefined) ?? [];
    const next = addBooks(current, biblios);
    if (next !== current) saveBooks(next);
  };

  const handleAddManualBook = () => {
    if (manualInput.trim() === "") {
      return;
    }

    const current =
      (useStore.getState().jsonData[elementName] as string[] | undefined) ?? [];
    const next = addBooks(current, [manualInput]);
    if (next !== current) saveBooks(next);
    setManualInput("");
  };

  const handleRemoveBook = (index: number) => {
    const current =
      (useStore.getState().jsonData[elementName] as string[] | undefined) ?? [];
    saveBooks(current.filter((_, i) => i !== index));
  };

  return (
    <>
      <Box sx={{ pt: 3 }}>
        <Button
          variant="outlined"
          onClick={handleOpenDialog}
          endIcon={<SearchIcon />}
        >
          Найти книги в библиотечной системе
        </Button>
      </Box>
      <List>
        {elementValue &&
          elementValue.map((biblio, index) => (
            <ListItem
              key={index}
              divider
              secondaryAction={
                <IconButton
                  color="error"
                  aria-label={`Удалить книгу ${index + 1}`}
                  onClick={() => handleRemoveBook(index)}
                >
                  <ClearIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={biblio}
                slotProps={{ primary: { sx: { fontSize: "14px" } } }}
              />
            </ListItem>
          ))}
      </List>

      <Box sx={{ mb: 2, py: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Введите библиографическое описание вручную"
          multiline
          minRows={3}
          sx={{
            "& .MuiInputBase-root": {
              alignItems: "flex-start",
              paddingTop: "8px",
              transition: "height 0.2s ease",
            },
          }}
        />
        <Box sx={{ pt: 1, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="contained" onClick={handleAddManualBook}>
            Добавить книгу
          </Button>
        </Box>
      </Box>

      <Dialog
        open={open}
        fullWidth
        maxWidth={findBooks.isSuccess && booksData?.length ? "xl" : "sm"}
        onClose={handleCloseDialog}
      >
        <DialogTitle>Поиск книг в библиотечной системе</DialogTitle>
        <DialogContent>
          <Box>
            <TextField
              autoFocus
              margin="dense"
              label="Ключевые слова"
              fullWidth
              variant="standard"
              value={bookName}
              onChange={handleBookNameChange}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleFindBooks();
                }
              }}
              helperText={
                findBooks.isPending ? (
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    Поиск книг...
                  </motion.div>
                ) : (
                  (errorMessage ??
                  (findBooks.isError
                    ? bookSearchError(findBooks.error)
                    : null) ??
                  (findBooks.isSuccess && booksData?.length === 0
                    ? "По вашему запросу ничего не найдено"
                    : null))
                )
              }
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Box sx={{ pb: 1 }}>
                        <IconButton
                          aria-label="Искать книги"
                          onClick={handleFindBooks}
                        >
                          <SearchIcon color="primary" />
                        </IconButton>
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {findBooks.isSuccess && booksData?.length ? (
              <Divider sx={{ mt: 1.5 }} />
            ) : null}
          </Box>
          {findBooks.isSuccess && findBooks.data.truncated && (
            <Box sx={{ pt: 2 }}>
              Показаны не все найденные записи. Уточните запрос: добавьте автора
              или год издания.
            </Box>
          )}
          {findBooks.isSuccess && booksData && booksData.length > 0 && (
            <BooksMetaList
              books={booksData}
              addBooksToList={handleAddBooksToList}
              closeDialog={handleCloseDialog}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddBook;
