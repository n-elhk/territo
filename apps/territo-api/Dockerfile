FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

FROM base AS build
COPY . .
RUN npx nx build territo-api --configuration=production

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/apps/territo-api ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
