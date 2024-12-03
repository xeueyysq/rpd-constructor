FROM node:20.11.1-alpine

WORKDIR /rpd-app

COPY package*.json ./

RUN npm install

COPY . .

# Install necessary tools
RUN apk add --no-cache netcat-openbsd curl

# Create script to wait for postgres and run migrations
COPY <<-"EOF" /docker-entrypoint.sh
#!/bin/sh
set -e

echo "Waiting for postgres..."
until nc -z -v -w30 db 5432
do
  echo "Waiting for postgres database connection..."
  sleep 5
done

echo "PostgreSQL started, running migrations..."
node ./app/migrations/migrations.js

echo "Starting application..."
exec "$@"
EOF

RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
