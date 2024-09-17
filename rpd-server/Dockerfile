FROM node:20.11.1-alpine

WORKDIR /rpd-app

COPY package*.json ./

RUN npm install

COPY . .

RUN apk add --no-cache curl bash

RUN curl -o wait-for-it.sh https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh \
    && chmod +x wait-for-it.sh

EXPOSE 8000

CMD ["./wait-for-it.sh", "db:5432", "--", "sh", "-c", "npm run migrate && npm run dev"]
