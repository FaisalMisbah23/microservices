# Stage 1: compile TypeScript to build/ (needs devDependencies)
FROM node:alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: runtime — production deps only, runs compiled JS
FROM node:alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/build ./build
CMD ["node", "build/index.js"]
