# 备份核心

Dockstash 将 `/var/www/<name>` 下的每个项目视为四个备份层的集合：项目文件、
数据库、反向代理配置以及 compose 元数据。本页说明 `scanProject` 如何检测项目
以及一次备份实际是如何执行的。

## `scanProject` 检测什么

给定项目路径后，`scanProject` 会：

1. 读取 `<path>/docker-compose.yml`。
2. 遍历每个服务。对每个 `image`，适配器注册表（`postgres`、`mysql`、
   `mariadb`、`mongo`）会认领并记录一个数据库层，包含解析后的容器名和仅由
   参数数组构成的转储命令。
3. 识别反向代理配置路径 —— Traefik 镜像对应 `/etc/traefik`，nginx 对应
   `/etc/nginx`。
4. 返回 `plan { paths, databases[], configs[] }`，你可以在 UI 中编辑后再保存
   到项目上。

## "先转储，再 restic" 规则

**绝不**从磁盘复制活跃的数据库文件。对每个启用的数据库层，Dockstash 都会执行
`docker exec <container> <dumpCmd>`，并将输出直接流式传给
`restic backup --stdin`。一致性参数已内置在每个适配器中：
`mysqldump --single-transaction`、`mongodump --oplog`、对运行中的服务器执行
`pg_dumpall`。

每条命令都是**参数数组**——没有 shell 插值，也没有 `sh -c`。像
`$(rm -rf /)` 这样的 compose 环境变量值会成为字面 token，而不是子 shell。

## `/var/www/*` 白名单

每条路径——项目自身路径、计划中的额外路径、API 提交的值——都会针对
`/var/www/*` 白名单验证。空字符串、`..` 遍历段、NUL 字节、符号链接快捷方式，
以及任何超出 `/var/www` 的路径，都会在到达 restic 或 dockerode 之前被拒绝。

## 所有权

项目按用户隔离。`/api/backups` 上的每个路由都需要 JWT，每个项目资源都通过
所有权检查加载：调用者不是所有者时返回 `403`。Restic 仓库密码仅以
AES-256-GCM 密文存储在项目记录中；明文只会在运行时进程内解密，绝不会返回给
客户端。
