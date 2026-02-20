FROM node:20-alpine

# Установка необходимых пакетов
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_DISABLE_HEADLESS_WARNING=true \
    npm_config_disturl=https://nodejs.org/download/release

# Установка временных зависимостей для сборки
RUN apk add --no-cache --virtual .build-deps build-base python3 make g++ \
    && apk add --no-cache netcat-openbsd curl

# Установка рабочих директорий
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей npm
RUN npm install

# Копирование остальных файлов приложения
COPY . .

# Удаление временных зависимостей
RUN apk del .build-deps

# Открытие порта
EXPOSE 8000

# Запуск приложения
CMD ["npm", "run", "dev"]
