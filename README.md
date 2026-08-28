<p align="center">
  <img src="https://user-images.githubusercontent.com/39998050/108494937-1a573e80-72e3-11eb-81c3-5545d7c2ed6e.jpg" width="200" height="200" alt="go-file">
</p>

<div align="center">

# Go File（n0vem 二次开发版）

_✨ 单可执行文件的局域网文件分享工具，将「文件 / 图床 / 视频」整合为统一的资源库 ✨_

</div>

<p align="center">
  <a href="https://raw.githubusercontent.com/n0vemb/go-file/master/LICENSE">
    <img src="https://img.shields.io/github/license/n0vemb/go-file?color=brightgreen" alt="license">
  </a>
  <a href="https://github.com/n0vemb/go-file">
    <img src="https://img.shields.io/badge/version-v0.0.3-brightgreen" alt="version">
  </a>
  <a href="#截图展示">
    <img src="https://img.shields.io/badge/UI-重构版-5b5bd6" alt="UI">
  </a>
</p>

> **二次开发说明**：本项目基于 [songquanpeng/go-file](https://github.com/songquanpeng/go-file) 二次开发，重构了 UI 与交互，
> 将文件、图床、视频整合为统一的「资源库」。修改者：**n0vem**，当前版本 **v0.0.3**，
> 仓库地址：[https://github.com/n0vemb/go-file](https://github.com/n0vemb/go-file)。
> 原项目作者：JustSong（[songquanpeng/go-file](https://github.com/songquanpeng/go-file)）。

## 功能亮点

1. **统一资源库**：文件、图片、视频、音频一处上传、一处管理，上传时**自动识别类型**。
2. **全新 UI**：基于内嵌 Vue 3 的自研设计系统，网格卡片布局，支持**亮 / 暗双主题**。
3. **多样化预览**：图片灯箱（左右切换、键盘操作）、视频 / 音频内嵌播放、文本在线预览。
4. **灵活的筛选**：按类型（全部 / 图片 / 视频 / 音频 / 文件）筛选、标签筛选、关键词搜索、排序、加载更多。
5. **批量管理**：管理员可框选多个文件，批量删除。
6. **便捷上传**：全局拖拽上传（跳过弹窗）、粘贴截图上传、多文件批量上传、上传进度提示。
7. **分享能力**：二维码扫码访问、一键复制链接、下载计数。
8. **零构建、单二进制**：前端资源全部 `go:embed` 内嵌，双击即可运行，开箱即用。
9. 兼容原项目：支持分享本地文件夹（`--path`）、本地视频目录（`--video`）、图片上传 API（PicGo / Typora 可用）、Token API、访问权限与频率限制。
10. Docker 一键部署。

## 截图展示

![资源库首页](docs/screenshots/home.png)

![上传弹窗](docs/screenshots/upload-modal.png)

![图片预览](docs/screenshots/preview.png)

![暗色主题](docs/screenshots/home-dark.png)

![登录页面](docs/screenshots/login.png)

## 快速开始

默认端口为 `3000`，程序在第一次启动时会自动创建管理员账户，用户名为 `admin`，密码为 `123456`，记得登录后到 `管理页面 -> 账户管理` 中修改密码。

```bash
# 本地运行
go run .

# 或者直接运行编译好的二进制
./go-file
```

程序启动后会自动打开浏览器，进入统一的「资源库」页面，点击右上角「＋ 上传」即可上传，也支持直接拖拽文件到页面任意位置。

**常用参数与环境变量：**

| 参数 / 环境变量 | 说明 | 示例 |
| --- | --- | --- |
| `--port` | 监听端口 | `./go-file --port 80` |
| `--host` | 指定可访问的 IP/域名（多网卡时保证二维码正确） | `./go-file --host 192.168.1.8` |
| `--path` | 分享本地文件夹（导航栏「文件」） | `./go-file --path ./public-files` |
| `--video` | 分享本地视频目录 | `./go-file --video ./videos` |
| `--no-browser` | 禁止自动打开浏览器 | `./go-file --no-browser` |
| `UPLOAD_PATH` | 上传文件存储路径（默认 `./upload`） | `UPLOAD_PATH=/data/files ./go-file` |
| `SQLITE_PATH` | SQLite 数据库路径（默认 `./go-file.db`） | `SQLITE_PATH=/data/gofile.db ./go-file` |
| `SQL_DSN` | 使用 MySQL（需先创建空数据库 `gofile`） | `SQL_DSN=root:123456@tcp(localhost:3306)/gofile` |
| `REDIS_CONN_STRING` | 启用访问频率控制 / 统计 | `REDIS_CONN_STRING=redis://default:redispw@localhost:49153` |
| `SESSION_SECRET` | 会话密钥（默认随机生成） | `SESSION_SECRET=your-secret ./go-file` |

## Docker 部署

镜像采用多阶段构建（`alpine` 运行时，静态编译，单文件约 10MB），数据持久化在 `/data` 目录。

**方式一：docker compose（推荐）**

```bash
cp .env.example .env        # 修改 .env 中的 SESSION_SECRET 为随机字符串
docker compose up -d --build
```

访问 `http://localhost:3000`，数据库（`go-file.db`）与上传文件（`upload/`）保存在宿主机的 `./data` 目录。

**方式二：docker run**

```bash
docker build -t go-file:v0.0.3 .
docker run -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -e SESSION_SECRET=your-random-secret \
  -v /home/ubuntu/data/go-file:/data \
  go-file:v0.0.3
```

**方式三：从 Docker Hub 拉取（多架构镜像由 GitHub Actions 自动构建）**

```bash
docker pull n0vem/go-file:v0.0.3
docker run -d --restart always -p 3000:3000 \
  -e SESSION_SECRET=your-random-secret \
  -v /home/ubuntu/data/go-file:/data \
  n0vem/go-file:v0.0.3
```

> GitHub Actions 会在推送到 `master` 时自动构建并推送 `linux/amd64` 与 `linux/arm64` 双架构镜像。
> 首次运行前需在仓库 Settings → Secrets and variables → Actions 中配置 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN`。

**NAS / 镜像源不支持多架构 manifest 时**：显式指定平台，或直接使用单架构标签 `amd64` / `arm64`。

```yaml
services:
  gofile:
    image: n0vem/go-file:amd64        # 或 n0vem/go-file:latest 加下方 platform
    container_name: gofile
    restart: always
    platform: linux/amd64             # 强制选择 amd64 变体
    ports:
      - "8909:3000"
    volumes:
      - /vol1/1000/docker/upload/files:/data
```

**常用环境变量：**

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 容器内监听端口 | `3000` |
| `SESSION_SECRET` | 会话密钥（务必设置随机值） | 随机生成 |
| `TZ` | 时区 | `Asia/Shanghai` |
| `UPLOAD_PATH` | 上传文件路径 | `/data/upload` |
| `SQLITE_PATH` | SQLite 数据库路径 | `/data/go-file.db` |
| `SQL_DSN` | MySQL 连接串（启用 MySQL） | 空 |
| `REDIS_CONN_STRING` | Redis 连接串（启用限流/统计） | 空 |

## 与原项目的兼容性

- 旧版上传 API（`/api/file`、`/api/image`）保持可用，启动时会自动将旧的文件、图床数据迁移进统一的资源库。
- 图片上传 API 兼容 PicGo（插件搜索 `gofile`）、Typora（[./script/typora.py](./script/typora.py)）。
- Token API 鉴权方式不变：请求头携带 `Authorization: YOUR_TOKEN` 或 `Bearer YOUR_TOKEN`。
- 权限控制（访客 / 普通用户 / 管理员）、频率限制、统计功能与原项目一致。

> 注意：`--no-browser` 为布尔参数，请直接使用 `./go-file --no-browser`，不要写成 `--no-browser true`（会导致后续参数无法解析）。

## 致谢

- 原作者 [JustSong](https://github.com/songquanpeng) 及原项目 [songquanpeng/go-file](https://github.com/songquanpeng/go-file)
- 本项目基于 [MIT License](LICENSE) 开源
