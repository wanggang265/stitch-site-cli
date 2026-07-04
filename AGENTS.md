# AGENTS.md — stitch-site CLI 维护与使用指南

## 这是什么？

`stitch-site-cli` 是一个**把 Stitch 设计包自动转换成 Next.js 站点**的 CLI 工具。它不是站点本身，而是生成站点的工具。

目标：设计团队从 Stitch 导出 `design-package.zip` 后，运行一条命令即可得到一个可构建、可部署、可二次开发的 Next.js 项目。

## 核心能力

1. 从 GitHub 模板初始化项目仓库（同账号自动创建新仓库 push；他人账号先 fork 再 clone）
2. 解析 `design-package.zip` 的页面、设计系统、资源文件
3. 把 HTML 页面转成 `app/**/page.tsx`（Next.js App Router）
4. 把 `design-system/` 中的颜色、字体写入 `globals.css`
5. 把 `assets/` 复制到 `public/`
6. 自动 `npm install` 与 `npm run build` 验证

## 仓库结构

```
stitch-site-cli/
├── src/
│   ├── index.ts      # CLI 入口（commander），参数解析与主流程编排
│   ├── template.ts   # 模板仓库 fork/clone/创建新仓库
│   ├── package.ts    # 用 jszip 解压并解析设计包
│   ├── parser.ts     # HTML → TSX 转换器（cheerio）
│   ├── mapper.ts     # 页面 → Next.js 路由/文件写入
│   ├── writer.ts     # design-system / assets 写入磁盘
│   ├── utils.ts      # 工具函数（exec、log、toRouteName 等）
│   └── types.ts      # 类型定义
├── tests/
│   ├── fixtures/
│   │   └── sample-design.zip   # 最小设计包样例
│   └── output/                 # 测试输出，gitignore 忽略
├── src/tests/        # 单元测试（node:test）
│   ├── parser.test.ts
│   ├── mapper.test.ts
│   ├── package.test.ts
│   └── utils.test.ts
├── README.md         # 用户-facing 使用说明
└── AGENTS.md         # 本文件：给维护 agent 的说明
```

## 主流程

```
CLI 参数解析
    ↓
准备模板仓库（prepareTemplate）
    ↓
加载设计包（loadDesignPackage）
    ↓
写页面（writePages）
    ↓
应用设计系统（applyDesignSystem）
    ↓
复制资源文件（copyAssets）
    ↓
npm install（可选）
    ↓
npm run build（可选）
```

## 设计包格式约定

Stitch 导出的 zip 必须满足以下结构，否则解析会失败或跳过：

```
design-package.zip
├── home/                   # 路由名：home → 站点根路由 ""
│   ├── code.html           # 页面 HTML（必须）
│   └── screen.png          # 可选截图，目前仅记录 hasScreenshot
├── pricing/                # 路由名：pricing → /pricing
│   ├── code.html
│   └── screen.png
├── design-system/
│   ├── colors.html         # 颜色 token
│   ├── typography.html     # 字体 token
│   └── spacing.html        # 间距 token
└── assets/
    ├── logo.svg            # 复制到 public/logo.svg
    └── favicon.ico
```

**注意：** 目前只解析 `design-system/` 下的 `colors.html`、`typography.html`、`spacing.html`。页面只识别 `code.html`。

## 作为 Agent 如何修改这个 CLI

### 1. 修改 HTML → TSX 转换逻辑

改 `src/parser.ts`：
- 属性名映射（`class` → `className`）在 `ATTRIBUTE_MAP`
- 需要新增框架组件（比如 `next/image` 的 `<Image>`）在 `nodeToTsx` 中处理
- 需要新增特殊属性转换也在 `nodeToTsx` 中处理

**改完后务必运行：**
```bash
npm run build
npm test
```

### 2. 修改页面路由或文件名生成

改 `src/mapper.ts` 或 `src/utils.ts`：
- `toRouteName` 控制目录名
- `toComponentName` / `toPascalCase` 控制组件名
- `writePage` 控制文件写入路径

### 3. 修改模板仓库逻辑

改 `src/template.ts`：
- 同账号创建新仓库：`createRepoFromTemplate`
- 不同账号 fork：`forkTemplate`
- 本地 clone：`cloneRepo`
- 远程操作依赖 `gh` CLI 和当前环境的 GitHub 认证

**测试时注意：** 测试会真实创建 GitHub 仓库。测试完成后必须删除，避免留下垃圾仓库。当前环境已授权 `delete_repo` scope，可用 `gh repo delete` 清理。

### 4. 修改设计系统解析/写入

改 `src/writer.ts` 与 `src/package.ts`：
- `writer.ts` 负责把 `designSystem` 对象写入 `globals.css`
- `package.ts` 负责从 zip 中提取设计系统文件
- 如果要解析 colors.html 里的具体结构，目前只是简单解析，后续可扩展

## 如何测试

```bash
# 编译 + 单元测试
npm run build
npm test

# 端到端测试（用样例设计包生成一个站点）
rm -rf tests/output
npx tsx src/index.ts init tests/fixtures/sample-design.zip tests/output/e2e-test --skip-fork

# 查看生成的页面
ls tests/output/e2e-test/app
```

### 测试规范

- 新增转换逻辑必须加 `src/tests/parser.test.ts` 用例
- 新增路由/写入逻辑必须加 `src/tests/mapper.test.ts` 用例
- 新增工具函数必须加 `src/tests/utils.test.ts` 用例
- 测试用 Node.js 内置 `node:test`，无需额外依赖

## 本地开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 本地 link 后当命令行工具用
npm link
stitch-site init path/to/design.zip my-site

# 不 link，直接用 tsx
npx tsx src/index.ts init path/to/design.zip my-site
```

## 重要参数

| 参数 | 含义 |
|------|------|
| `--template <url>` | 指定模板仓库 |
| `--skip-fork` | 跳过 GitHub fork/创建新仓库，仅本地 clone |
| `--skip-install` | 跳过 `npm install` |
| `--skip-build` | 跳过 `npm run build` |

## 常见问题与排查

### 1. `gh` 命令失败

检查：
```bash
gh auth status
```

确保当前账号对模板仓库有权限，且已登录。

### 2. 生成的 TSX 缩进不好看

这是 `src/parser.ts` 中的文本节点处理策略。当前实现会归一化 HTML 缩进文本节点，生成相对扁平但一致的 TSX。如果需要更严格的格式化，可以考虑引入 `prettier` 作为可选依赖，但当前保持零依赖优先。

### 3. 页面中某些标签/属性没转换

在 `parser.ts` 的 `nodeToTsx` 中打断点或加日志。当前支持：
- `class` → `className`
- 内联 `style` → `style={{ ... }}`
- 内部 `<a>` → `<Link>`（Next.js）
- 带 width/height 的 `<img>` → `<Image>`（Next.js）
- 常见布尔属性

未支持的属性默认按原名传递。

### 4. 设计包没有 colors.html/typography.html

`writer.ts` 会跳过缺失项，不会报错。但生成的 `globals.css` 可能没有设计 token。

## 设计原则

1. **零依赖优先**：尽量用 Node.js 内置能力 + `jszip`/`cheerio`/`commander` 这三个核心依赖。
2. **可测试**：每个转换步骤都可以独立单元测试。
3. **透明**：失败时抛出明确错误，日志用 `[stitch-site]` 前缀。
4. **不覆盖用户设计**：只生成基础骨架，不自动美化或改动设计语义。

## 与其它 Agent 的分工建议

- **如果要改设计包解析格式**：改 `src/package.ts` + `src/types.ts`
- **如果要改 HTML 转换规则**：改 `src/parser.ts` + `src/tests/parser.test.ts`
- **如果要改 Next.js 路由/页面结构**：改 `src/mapper.ts` + `src/tests/mapper.test.ts`
- **如果要改模板仓库拉取逻辑**：改 `src/template.ts`（注意真实 GitHub 操作）
- **如果要改设计系统写入**：改 `src/writer.ts`

**不要做的事：**
- 不要给 `src/index.ts` 塞业务逻辑，保持它只做编排。
- 不要引入重型格式化/构建工具，除非经过测试和讨论。
- 不要直接修改 `tests/fixtures/sample-design.zip` 除非同步更新测试断言。

## 发布

目前未接入 npm 发布流程。需要发布时：
1. 更新 `package.json` 版本号
2. 确保 `npm run build && npm test` 全绿
3. 由有权限的账号执行 `npm publish`

---

如果你只是**使用这个 CLI 生成站点**，请看 `README.md`。本文件是给需要维护/扩展这个 CLI 的 agent 看的。
