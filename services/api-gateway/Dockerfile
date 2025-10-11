FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm i --prod
COPY src ./src
COPY tsconfig.json ./
CMD ["node", "--loader", "tsx", "src/index.ts"]
