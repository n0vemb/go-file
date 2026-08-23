# ---------- Build stage ----------
FROM golang:1.24-alpine AS builder

ENV GO111MODULE=on \
    CGO_ENABLED=1 \
    GOPROXY=https://goproxy.cn,direct \
    CGO_CFLAGS="-D_LARGEFILE64_SOURCE=1"

RUN apk add --no-cache gcc musl-dev

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

ENV TZ=Asia/Shanghai \
    PORT=3000

COPY --from=builder /build/go-file /usr/local/bin/go-file

# 数据目录：数据库（go-file.db）与上传文件（upload/）均保存在此
WORKDIR /data
VOLUME ["/data"]

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/go-file"]
CMD ["--no-browser"]
