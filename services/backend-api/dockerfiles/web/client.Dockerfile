FROM node:18 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . ./

# Build production files
FROM node:18-alpine AS prod

RUN apt install curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

RUN npm run build

RUN npm prune --production
RUN /usr/local/bin/node-prune

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist dist

ENV BACKEND_API_PORT=3000
HEALTHCHECK --interval=5s --timeout=10s --retries=3 CMD wget http://localhost:3000 -q -O - > /dev/null 2>&1

CMD [ "node", "./dist/main" ]
