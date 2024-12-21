# FROM node:20.11.1-alpine

# WORKDIR /rpd-app

# COPY package*.json ./

# RUN npm install

# COPY . .

# RUN apk add --no-cache curl bash

# RUN curl -o wait-for-it.sh https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh \
#     && chmod +x wait-for-it.sh

# EXPOSE 8000

# # Add a healthcheck to ensure database is ready
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
#     CMD node ./healthcheck.js

# # Modified command to ensure migrations run before starting the server
# CMD ["./wait-for-it.sh", "db:5432", "-t", "60", "--", "sh", "-c", "npm run migrate && npm run dev"]
FROM node:20.11.1-alpine

WORKDIR /rpd-app

COPY package*.json ./

RUN npm install

COPY . .

# Install necessary tools
RUN apk add --no-cache netcat-openbsd curl

# # Create script to wait for postgres and run migrations
# COPY <<-"EOF" /docker-entrypoint.sh
# #!/bin/sh
# set -e

# echo "Waiting for postgres..."
# until nc -z -v -w30 db 5432
# do
#   echo "Waiting for postgres database connection..."
#   sleep 5
# done

# echo "PostgreSQL started, running migrations..."
# node ./app/migrations/migrations.js

# echo "Starting application..."
# exec "$@"
# EOF

# RUN chmod +x /docker-entrypoint.sh

# EXPOSE 8000

# ENTRYPOINT ["/docker-entrypoint.sh"]
# CMD ["npm", "run", "dev"]

EXPOSE 8000

CMD ["npm", "run", "dev"]
