FROM node:24-alpine

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm install --omit=dev --no-fund --no-audit

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
