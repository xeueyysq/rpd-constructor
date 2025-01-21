FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache --virtual .builds-deps build-base python3 make g++ \
    && apk add --no-cache netcat-openbsd curl

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm rebuild bcrypt --build-from-source \
    && apk del .builds-deps

EXPOSE 8000

CMD ["npm", "run", "dev"]
