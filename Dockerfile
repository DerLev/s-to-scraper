FROM node:20-slim AS base

# Install all needed server dependencies
FROM base AS server-deps

WORKDIR /app

# disable installation of standalone browser from Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY server/package.json server/yarn.lock* ./
RUN yarn --frozen-lockfile

# build the server
FROM base AS server-builder

WORKDIR /app
COPY --from=server-deps /app/node_modules ./node_modules
COPY server/ .

RUN yarn build

FROM base AS client-deps

WORKDIR /app
COPY client/package.json client/yarn.lock* ./
RUN yarn --frozen-lockfile

# build the client
FROM base AS client-builder

WORKDIR /app
COPY --from=client-deps /app/node_modules ./node_modules
COPY client/ .

RUN yarn build

# active runner
FROM base AS runner

WORKDIR /app

# Install Google Chrome for Puppeteer
RUN apt-get update && apt-get install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt-get install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY server/package.json ./
COPY --from=server-deps /app/node_modules ./node_modules
COPY --from=server-builder /app/build ./build
COPY --from=client-builder /app/dist ./client

USER nodejs

EXPOSE 3000

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "build/app.js"]
