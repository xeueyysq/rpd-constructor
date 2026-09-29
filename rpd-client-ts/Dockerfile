FROM node:22-alpine as builder

WORKDIR /app

RUN apk add --no-cache curl bash unzip \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
ENV PATH="/root/.bun/bin:${PATH}"

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

ENV VITE_API_URL=
RUN bun run build

FROM nginx:alpine

COPY --from=0 /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
