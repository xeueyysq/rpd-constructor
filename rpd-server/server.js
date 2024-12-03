const express = require('express');
const bodyParser = require('body-parser');
const { pool } = require('./config/db');
const routes = require('./app/routes/routes');
const app = express();
const cors = require('cors');
const fileUpload = require('express-fileupload');
const port = 8000;

const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const Fingerprint = require('express-fingerprint');
const AuthRootRouter = require('./app/routes/Auth');
const TokenService = require('./app/services/Token');

dotenv.config();

app.use(cookieParser());
app.use(express.json());

app.use(bodyParser.urlencoded({ extended: true }));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://89.169.130.200:8080',
  'http://89.169.130.200'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
}));

app.use(fileUpload());

app.use(
  Fingerprint({
    parameters: [Fingerprint.useragent, Fingerprint.acceptHeaders],
  })
);

pool.connect()
  .then(() => {
    console.log('Connected to PostgreSQL');

    app.use(express.json());
    // Передаем pool в роуты, чтобы их можно было использовать для запросов к базе данных.
    app.use('/api', routes);
    app.use("/auth", AuthRootRouter);

    app.get("/resource/protected", TokenService.checkAccess, (_, res) => {
      res.status(200).json("Добро пожаловать!" + Date.now());
    });
    
    app.listen(port, () => {
      console.log('We are live on ' + port);
    });
  })
  .catch((err) => {
    console.error('Error connecting to PostgreSQL', err);
  });