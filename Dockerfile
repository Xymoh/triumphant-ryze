# Debian-based image: the native sqlite3 module ships prebuilt glibc binaries, so no compiler is needed.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# SQLite fallback lives here; mount a volume (or set DATABASE_URL) so data survives restarts.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
CMD ["node", "index.js"]
