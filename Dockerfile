FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Keep dependency installation cacheable; package-lock.json pins the full tree.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline \
    && npm cache clean --force

# .dockerignore excludes the website, Git history, and local runtime/secrets.
COPY . .

EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
