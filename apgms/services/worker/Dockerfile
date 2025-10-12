FROM node:20-alpine AS base

WORKDIR /usr/src/app

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install && npm run build

CMD ["node", "dist/index.js"]
