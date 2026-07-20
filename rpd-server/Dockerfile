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
    PUPPETEER_DISABLE_HEADLESS_WARNING=true

# Установка временных зависимостей для сборки
RUN apk add --no-cache --virtual .build-deps build-base python3 make g++ \
    && apk add --no-cache netcat-openbsd curl bash unzip

# Установка bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Установка рабочих директорий
WORKDIR /app

# Копирование package.json и bun.lock
COPY package.json bun.lock ./

# Установка зависимостей
RUN bun install

# Копирование остальных файлов приложения
COPY . .

# Пересборка bcrypt
RUN npm rebuild bcrypt --build-from-source

# Удаление временных зависимостей
RUN apk del .build-deps

# Открытие порта
EXPOSE 8000

# Запуск приложения
CMD ["bun", "run", "dev"]
