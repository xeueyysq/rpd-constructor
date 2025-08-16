import { ChangeEvent, FC, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ShowBooks from "./ShowBooks.tsx";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";
import { IconButton } from "@mui/material";

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
  const [bookName, setBookName] = useState<string>("");
  const [error, setError] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>("");

  const jsonData = useStore.getState().jsonData[elementName];
  const [booksData, setBooksData] = useState<BookData[]>(jsonData);

  const elementValue: string[] =
    useStore.getState().jsonData[elementName] || [];
  const [addedBooks, setAddedBooks] = useState<string[]>(elementValue);

  const { updateJsonData } = useStore();

  const handleOpenDialog = () => {
    setOpen(true);
    setBooksData([]);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setError(false);
  };

  const handleBookNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBookName(event.target.value);
    if (error) setError(false);
  };

  const handleFindBooks = async () => {
    if (!bookName) {
      setError(true);
      return;
    }
    setError(false);

    try {
      const response = await axiosBase.post("find-books", { bookName });
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
    handleCloseDialog();
  };

  const handleAddBookToList = (biblio: string) => {
    saveContent([...addedBooks, biblio]);
  };

  const handleAddManualBook = () => {
    if (manualInput.trim() === "") {
      setError(true);
      return;
    }
    setError(false);

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
          size="small"
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

                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleRemoveBook(biblio)}
                    >
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
          <TextField
            autoFocus
            margin="dense"
            label="Ключевые слова"
            fullWidth
            variant="standard"
            value={bookName}
            onChange={handleBookNameChange}
            error={error}
            helperText={error ? "Ошибка. Поле обязательно для заполнения" : ""}
          />
          {booksData && (
            <ShowBooks
              books={booksData}
              onAddBookToList={handleAddBookToList}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleFindBooks}>
            Найти
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddBook;
