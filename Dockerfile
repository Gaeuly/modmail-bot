FROM golang:1.23-bookworm AS litestream

# Static build of litestream
RUN go install \
    -ldflags "-s -w -extldflags "-static"" \
    -tags osusergo,netgo,sqlite_omit_load_extension \
     github.com/benbjohnson/litestream/cmd/litestream@latest

FROM oven/bun:1.2.17-debian

# Static labels
LABEL org.opencontainers.image.source=https://github.com/sushiibot/sushii-modmail
LABEL org.opencontainers.image.description="Discord Modmail Bot"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    # root certs for ssl
    ca-certificates \
    # curl for healthcheck
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy litestream binary from the previous stage
COPY --from=litestream /go/bin/litestream /usr/local/bin/litestream

# Copy default configuration for litestream
COPY ./litestream.yml /etc/litestream.yml

# Copy package.json and lockfile first for better caching
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Application source code
COPY ./emojis/composites ./emojis/composites
COPY ./tsconfig.json ./
COPY ./drizzle ./drizzle
COPY ./src ./src

# Entrypoint script
COPY ./scripts ./scripts

# Build info, args at end to minimize cache invalidation
ARG GIT_HASH
ARG BUILD_DATE

# Make build info available in the app
ENV GIT_HASH=${GIT_HASH}
ENV BUILD_DATE=${BUILD_DATE}

LABEL org.opencontainers.image.revision=${GIT_HASH}
LABEL org.opencontainers.image.created=${BUILD_DATE}

# Healthcheck using the built-in healthcheck endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set the command to run the bot
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
