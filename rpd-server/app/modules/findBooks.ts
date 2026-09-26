import type { ParamsDictionary } from "express-serve-static-core";
import type { Request, Response } from "express";
import axios from "axios";

const findBooks = async (req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) => {
  try {
    const { bookName } = req.body;
    if (!bookName) return res.status(400).send("Book name is required");
    const libraryApi = `https://lib.uni-dubna.ru/MegaPro/API?Method=LIC_Search&query=${bookName}&inFulltext=false&limit=100`;
    const response = await axios.get<unknown>(libraryApi);

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error during book search:", error);
    res.status(500).send("Server error occurred while searching for books");
  }
};

export default findBooks;
