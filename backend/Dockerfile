FROM ubuntu:24.04 AS builder

RUN apt-get update && apt-get install -y \
  build-essential cmake git \
  libssl-dev zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy source
COPY ws-server/ ./ws-server/

# Clone dependencies
RUN mkdir -p ws-server/deps && \
    git clone --depth 1 --recurse-submodules https://github.com/uNetworking/uWebSockets.git ws-server/deps/uWebSockets && \
    git clone --depth 1 --branch v3.11.3 https://github.com/nlohmann/json.git ws-server/deps/json

# Build
RUN cmake -S ws-server -B ws-server/build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build ws-server/build --parallel $(nproc)

# ── Runtime image ────────────────────────────────────────────────────────────

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
  libssl3 zlib1g ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/ws-server/build/wigma-ws-server /usr/local/bin/

ENV WS_PORT=9001
EXPOSE 9001

ENTRYPOINT ["wigma-ws-server"]
