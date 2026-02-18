FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
COPY apps/worker ./apps/worker
RUN npm install
RUN npm --workspace @squadronforge/api run prisma:generate
RUN npm --workspace @squadronforge/worker run build
CMD ["npm", "--workspace", "@squadronforge/worker", "run", "start"]
