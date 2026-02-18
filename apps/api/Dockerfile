FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
RUN npm install
RUN npm --workspace @squadronforge/api run prisma:generate
RUN npm --workspace @squadronforge/api run build
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && npm --workspace @squadronforge/api run prisma:seed && npm --workspace @squadronforge/api run start"]
