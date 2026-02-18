FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
RUN npm install
RUN npm --workspace @squadronforge/web run build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
