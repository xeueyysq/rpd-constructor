const express = require("express");
const bodyParser = require("body-parser");
const { pool } = require("./config/db");
const routes = require("./app/routes/routes");
const app = express();
const cors = require("cors");
const fileUpload = require("express-fileupload");

const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const Fingerprint = require("express-fingerprint");
const AuthRootRouter = require("./app/routes/Auth");
const TokenService = require("./app/services/Token");


dotenv.config();
const { PORT, CLIENT_URL, API_URL } = process.env;

app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// OPTIONS-запросы для Preflight
app.options("*", cors());

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
