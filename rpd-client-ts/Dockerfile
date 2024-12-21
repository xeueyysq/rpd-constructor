# Stage 1: Build the React app
FROM node:20.11.1-alpine as build

WORKDIR /usr/src/app

COPY package*.json ./

# Очищаем кэш npm и устанавливаем зависимости
RUN npm cache clean --force && \
    npm install

COPY . .

# Увеличиваем лимит памяти Node.js
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Собираем приложение
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:stable-alpine

# Создаем директорию для статических файлов
RUN mkdir -p /usr/share/nginx/html

# Копируем собранные файлы
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Проверяем, что файлы существуют
RUN ls -la /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
