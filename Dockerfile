# ---------- Build stage ----------
FROM golang:1.24-alpine AS builder

ENV GO111MODULE=on \
    CGO_ENABLED=1 \
    GOPROXY=https://goproxy.cn,direct \
    CGO_CFLAGS="-D_LARGEFILE64_SOURCE=1"

RUN apk add --no-cache gcc musl-dev

# apk 走直连，不走构建器代理（socks5 代理下 apk 不可用）
ENV http_proxy= https_proxy= HTTP_PROXY= HTTPS_PROXY=

WORKDIR /build

# Cache dependencies first
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=v0.0.1
RUN go build -trimpath \
    -ldflags "-s -w -X 'go-file/common.Version=${VERSION}' -extldflags '-static'" \
    -o go-file .

# ---------- Runtime stage ----------
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

# 运行阶段无需代理
ENV http_proxy= https_proxy= HTTP_PROXY= HTTPS_PROXY=

ENV TZ=Asia/Shanghai \
    PORT=3000

COPY --from=builder /build/go-file /usr/local/bin/go-file

LABEL org.opencontainers.image.source="https://github.com/n0vemb/go-file" \
      org.opencontainers.image.title="Go File" \
      org.opencontainers.image.description="Unified file/image/video sharing, fork of songquanpeng/go-file"

# 数据目录：数据库（go-file.db）与上传文件（upload/）均保存在此
WORKDIR /data
VOLUME ["/data"]

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/go-file"]
CMD ["--no-browser"]
