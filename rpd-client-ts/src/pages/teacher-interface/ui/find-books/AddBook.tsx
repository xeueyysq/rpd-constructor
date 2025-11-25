import { ChangeEvent, FC, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  TextField,
} from "@mui/material";
import ShowBooks from "./ShowBooks.tsx";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";

interface AddBook {
  elementName: string;
}

interface BookData {
  title: string;
  author: string;
  biblio: string;
  url: string;
  thumb?: string;
  // ... другие поля, если они есть
}

const AddBook: FC<AddBook> = ({ elementName }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [bookName, setBookName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");

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
    setBooksData(null);
    setErrorMessage(null);

    try {
      const response = await axiosBase.post("find-books", { bookName });
      const books = response.data;
      if (!books.length) {
        setErrorMessage("По вашему запросу ничего не найдено");
        return;
      }
      setBooksData(response.data);
    } catch (error) {
      console.error(error);
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

  const handleAddBookToList = (biblio: string) => {
    saveContent([...addedBooks, biblio]);
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
        <Button
          variant="contained"
          onClick={handleOpenDialog}
          // endIcon={<AddIcon />}
        >
          Найти книги
        </Button>
      </Box>
      <List>
        {elementValue &&
          elementValue.map((biblio, index) => (
            <>
              <ListItem key={index}>
                <ListItemText>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontFamily: "Times New Roman",
                    }}
                  >
                    <Box width={"90%"}>{biblio}</Box>

                    <Button color="error" onClick={() => handleRemoveBook(biblio)}>
                      Удалить
                    </Button>
                  </Box>
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
          minRows={2}
          maxRows={6}
          sx={{
            "& .MuiInputBase-root": {
              alignItems: "flex-start",
              paddingTop: "8px",
              transition: "height 0.2s ease",
            },
          }}
        />
        <Button onClick={handleAddManualBook}>Добавить</Button>
      </Box>

      <Dialog
        open={open}
        onClose={handleCloseDialog}
        sx={{
          "& .MuiDialog-container": {
            "& .MuiPaper-root": {
              width: "100%",
              maxWidth: "800px",
            },
          },
        }}
      >
        <DialogTitle>Поиск книг</DialogTitle>
        <DialogContent>
          <Box position="sticky" top={0} zIndex={1} bgcolor="background.paper">
            <TextField
              autoFocus
              margin="dense"
              label="Ключевые слова"
              fullWidth
              variant="standard"
              value={bookName}
              onChange={handleBookNameChange}
              helperText={errorMessage}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Box pb={1}>
                        <Button variant="contained" onClick={handleFindBooks}>
                          Найти
                        </Button>
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <ShowBooks books={booksData} onAddBookToList={handleAddBookToList} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddBook;
