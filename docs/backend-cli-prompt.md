# 任务：基于 removepdfpages 经验，实现 stitch-backend-cli

## 背景与目标

我们在跑 `removepdfpages` 项目时，发现建站过程中最耗时、最容易出错的部分不是写业务代码，而是**申请和管理各种 token、secret、API key、环境变量**。

本项目要求你实现一个后端 CLI 工具 `stitch-backend-cli`，它的核心目标不是“写更多后端代码”，而是**把建站过程中 token 相关的重复劳动降到最低**。它要与前端 CLI `stitch-site-cli` 配合，但独立负责后端服务。

## 第一步：复盘 removepdfpages

在写任何代码之前，你先做以下复盘：

1. 查看 `/home/ubuntu/projects/removepdfpages-workers` 项目
2. 列出所有使用过的 token/secret/credential/ID，包括但不限于：
   - Cloudflare API Token（用于 `wrangler deploy`）
   - Cloudflare Account ID
   - Cloudflare Zone ID
   - D1 database ID / binding name
   - R2 bucket name / binding name
   - Creem API Key（生产环境）
   - Creem Webhook Secret
   - JWT Secret / Signing Key
   - 任何自定义的 API key
3. 对每个 token，标注：
   - 它是怎么生成的（手动网页申请 / 命令行生成 / API 调用）
   - 是否可以在新项目中复用
   - 是否可以通过 CLI 自动化获取或生成
   - 在 `wrangler.toml`、`.dev.vars`、环境变量中分别叫什么名字

把这份复盘写成 `LESSONS_LEARNED.md` 放在 `stitch-backend-cli` 仓库里。

## 第二步：实现 stitch-backend-cli

### 技术栈

- TypeScript + Node.js
- Commander（CLI）
- Hono（后端框架）
- Cloudflare Workers（运行平台）
- `node:test`（测试）
- `wrangler` CLI（部署）

### 核心能力

#### 1. 项目初始化

```bash
stitch-backend init <project-name>
```

- 从默认模板生成后端项目
- 支持同账号创建 GitHub 新仓库并 push
- 支持 `--skip-fork`
- 生成 `wrangler.toml`、`.dev.vars`、`.env.example`、`src/index.ts`

#### 2. 本地凭证库（关键）

```bash
stitch-backend vault init
stitch-backend vault list
stitch-backend vault add <name>
stitch-backend vault use <name> <project-dir>
```

CLI 应该在用户主目录下维护一个本地加密文件：

```
~/.stitch-backend/vault
```

**vault 加密要求：**

- 用 AES 或类似对称加密算法
- 加密密钥由用户输入的“主密码”派生（如 PBKDF2）
- 主密码只存内存，不存任何文件
- vault 文件内容是密文，没有主密码无法读取

**vault 里存什么：**

必须进 vault：
- Cloudflare API Token
- Creem API Key
- Creem Webhook Secret
- JWT Secret
- 任何第三方 API Key

不能进 vault（写普通 config 文件）：
- Cloudflare Account ID
- Cloudflare Zone ID
- D1/R2 binding name
- 项目名、路由配置

#### 3. 自动复用 removepdfpages 的 token

```bash
stitch-backend import-from removepdfpages-workers
```

读取 `/home/ubuntu/projects/removepdfpages-workers` 的：
- `wrangler.toml`
- `.dev.vars`
- 项目里的 `package.json`
- 源代码中用到的环境变量名

提取所有 token 和配置，存入 vault，并生成一份 `import-report.md` 说明：
- 哪些已识别并自动导入
- 哪些需要手动补充
- 哪些在新项目中可以复用

#### 4. 自动生成可生成的 token

对于可以在本地生成的 secret，CLI 应该自动生成：
- JWT Secret（`crypto.randomUUID` 或 `openssl rand`）
- 测试用的 API Key
- 本地开发 nonce

**不要生成、也绝不要尝试生成：**
- Cloudflare API Token
- Creem API Key
- 任何第三方平台的付费/安全凭证

#### 5. Secrets 自动写入

```bash
stitch-backend setup-secrets
stitch-backend deploy
```

- `setup-secrets`：提示用户输入主密码，从 vault 读取 secret，调用 `wrangler secret put` 上传到 Cloudflare
- `deploy`：部署成功后，把后端 URL 写回 `stitch.json`
- 部署时不在本地生成包含 secret 的临时文件

#### 6. 与前端 CLI 的协作

前端 CLI 生成 `stitch.json`。你的 CLI 读取并更新 `backend` 部分：

```json
{
  "project": "removepdfpages",
  "frontend": {
    "repo": "owner/site-repo",
    "url": "https://example.com"
  },
  "backend": {
    "repo": "owner/backend-repo",
    "url": "https://api.example.com",
    "tokens": {
      "CREEM_API_KEY": "vault:creem-api-key",
      "JWT_SECRET": "vault:jwt-secret"
    }
  }
}
```

#### 7. 常用路由生成

```bash
stitch-backend add-route <name>
```

示例：
- `stitch-backend add-route remove-pages` → `/api/remove`
- `stitch-backend add-route credits` → `/api/credits`
- `stitch-backend add-route checkout` → `/api/checkout`
- `stitch-backend add-route webhook` → `/api/webhook`

每个路由包含：
- 输入校验
- CORS
- 错误处理
- 日志

### 凭证安全要求（必须遵守）

1. **绝不把 vault 文件提交到 git**
   - 在模板仓库的 `.gitignore` 中排除 `~/.stitch-backend/`
   - 在 `README.md` 和 `AGENTS.md` 中用醒目方式提醒

2. **绝不把 secret 明文打印到终端**
   - 日志中显示 `***` 或 `[REDACTED]`

3. **绝不把 API Key 写进 `wrangler.toml`**
   - `wrangler.toml` 可以进 git，但只放非敏感配置

4. **绝不把主密码存在文件里**
   - 主密码由用户每次使用时输入
   - 提供可选的 `STITCH_BACKEND_VAULT_PASS` 环境变量，仅用于 CI 场景

5. **部署时只通过 `wrangler secret put` 上传 secret**

### 输出文件

仓库里必须包含：
1. `README.md` — 用户如何使用
2. `AGENTS.md` — 后续 agent 如何维护
3. `LESSONS_LEARNED.md` — 从 removepdfpages 复盘的经验
4. `SECURITY.md` — vault 设计、安全边界、禁止事项
5. 完整的 CLI 源码和测试

### 设计原则

1. **凭证优先复用**：能用 vault 里的旧 token，就不让用户重新输入
2. **能本地生成就本地生成**：JWT、nonce 等不再手动
3. **不能自动的明确告诉用户**：需要手动申请的 token，给出申请链接和需要勾选哪些权限
4. **安全优先**：vault 加密、主密码不落盘、secret 不上传 git
5. **独立可运行**：不依赖前端 CLI，但能与前端 CLI 通过 `stitch.json` 协作

## 验证标准

1. `npm run build && npm test` 全绿
2. 能执行 `stitch-backend init test-backend --skip-fork` 生成可运行项目
3. 能执行 `stitch-backend import-from removepdfpages-workers` 生成 vault 和报告
4. 生成的 Hono 项目能 `wrangler dev` 不报错
5. 有清晰的文档说明哪些 token 自动、哪些手动
6. vault 文件不能是明文或 base64 混淆

## 先做哪件

顺序：
1. 复盘 removepdfpages，输出 `LESSONS_LEARNED.md`
2. 实现 `vault` 的增删查（加密存储 + 主密码）
3. 实现 `import-from` 命令
4. 实现 `init` 命令
5. 实现 `setup-secrets` 和 `deploy`
6. 实现 `add-route`

有困难先回问。
