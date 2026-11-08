FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g bun@1.3.13

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

CMD ["npm", "start"]
