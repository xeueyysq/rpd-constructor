import express from "express";

import { pool } from "./config/db.ts";
import routes from "./app/routes/routes.ts";
const app = express();
import cors from "cors";
import fileUpload from "express-fileupload";

import cookieParser from "cookie-parser";
import Fingerprint from "./app/middleware/fingerprint.ts";
import AuthRootRouter from "./app/routes/Auth.ts";
import TokenService from "./app/services/Token.ts";

const { PORT, CLIENT_URL, API_URL } = process.env;

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8000",
  "http://localhost:8080",
  "http://localhost",
  "http://localhost:80",
  "http://localhost:5432",
  CLIENT_URL,
  API_URL,
];

// CORS Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Разрешаем запросы без origin (например, с Postman)
      if (allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

app.use(fileUpload());

app.use(
  Fingerprint({
    parameters: [Fingerprint.useragent, Fingerprint.acceptHeaders],
  })
);

pool
  .connect()
  .then(() => {
    console.log("Подключено к PostgreSQL");

    app.use("/api", routes);
    app.use("/auth", AuthRootRouter);

    app.get("/resource/protected", TokenService.checkAccess, (_, res) => {
      res.status(200).json("Добро пожаловать! " + Date.now());
    });

    app.listen(PORT, () => {
      console.log(`Сервер запущен на ${API_URL}`);
    });
  })
  .catch((err) => {
    console.error("Ошибка подключения к PostgreSQL", err);
  });
