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
  Typography,
} from "@mui/material";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";
import { BooksMetaList } from "./BooksMetaList.tsx";
import { motion } from "framer-motion";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";

interface AddBook {
  elementName: string;
}

interface BookData {
  title: string;
  author: string;
  biblio: string;
  url: string;
  thumb?: string;
  published: string;
}

const AddBook: FC<AddBook> = ({ elementName }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [bookName, setBookName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");
  const [isLoadingBooks, setIsLoadingBooks] = useState<boolean>(false);

  const jsonData = useStore.getState().jsonData[elementName];
  const [booksData, setBooksData] = useState<BookData[] | null>(jsonData);

  const elementValue: string[] = useStore.getState().jsonData[elementName] || [];
  const [addedBooks, setAddedBooks] = useState<string[]>(elementValue);

  const { updateJsonData } = useStore();

  const handleOpenDialog = () => {
    setOpen(true);
    setBooksData([]);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setErrorMessage(null);
    setBookName(null);
  };

  const handleBookNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBookName(event.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleFindBooks = async () => {
    if (!bookName) {
      setErrorMessage("Поле обязательно для заполнения");
      return;
    }
    // setBooksData(null);
    setIsLoadingBooks(true);
    setErrorMessage(null);

    try {
      const response = await axiosBase.post("find-books", { bookName });
      const books = response.data;
      if (!books.length) {
        setErrorMessage("По вашему запросу ничего не найдено");
        setBooksData(null);
        return;
      }
      setBooksData(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const saveContent = async (htmlValue: string[]) => {
    const templateId = useStore.getState().jsonData.id;

    try {
      await axiosBase.put(`update-json-value/${templateId}`, {
        fieldToUpdate: elementName,
        value: htmlValue,
      });

      updateJsonData(elementName, htmlValue);
      setAddedBooks(htmlValue);
      showSuccessMessage("Данные успешно сохранены");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  const handleAddBooksToList = (biblios: string[]) => {
    //TODO добавить фильтр на добавление книг
    saveContent([...addedBooks, ...biblios]);
  };

  const handleAddManualBook = () => {
    if (manualInput.trim() === "") {
      return;
    }

    const newBooks = [...addedBooks, manualInput];
    saveContent(newBooks);
    setManualInput("");
  };

  const handleRemoveBook = (biblioToRemove: string) => {
    const newBooks = addedBooks.filter((biblio) => biblio !== biblioToRemove);
    saveContent(newBooks);
  };

  return (
    <>
      <Box pt={3}>
        <Button variant="outlined" onClick={handleOpenDialog} endIcon={<SearchIcon />}>
          Найти книги в библиотечной системе
        </Button>
      </Box>
      <List>
        {elementValue &&
          elementValue.map((biblio, index) => (
            <>
              <ListItem key={index}>
                <ListItemText>
                  <Typography
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography fontSize={"14px"}>{biblio}</Typography>
                    <IconButton color="error" onClick={() => handleRemoveBook(biblio)}>
                      <ClearIcon />
                    </IconButton>
                  </Typography>
                </ListItemText>
              </ListItem>
              <Divider />
            </>
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
        <Box pt={1} display={"flex"} justifyContent={"flex-end"}>
          <Button variant="contained" onClick={handleAddManualBook}>
            Добавить книгу
          </Button>
        </Box>
      </Box>

      <Dialog
        open={open}
        fullWidth
        maxWidth={booksData && booksData.length > 0 ? "xl" : "sm"}
        onClose={handleCloseDialog}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleFindBooks();
        }}
      >
        <DialogTitle>Поиск книг в библиотечной системе</DialogTitle>
        <DialogContent>
          <Box position="sticky" top={0} zIndex={2} bgcolor="background.paper">
            <TextField
              autoFocus
              margin="dense"
              label="Ключевые слова"
              fullWidth
              variant="standard"
              value={bookName}
              onChange={handleBookNameChange}
              helperText={
                isLoadingBooks ? (
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Поиск книг...
                  </motion.div>
                ) : (
                  errorMessage
                )
              }
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Box pb={1}>
                        <IconButton onClick={handleFindBooks}>
                          <SearchIcon color="primary" />
                        </IconButton>
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          {booksData && booksData?.length > 0 && (
            <BooksMetaList books={booksData} addBooksToList={handleAddBooksToList} closeDialog={handleCloseDialog} />
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
