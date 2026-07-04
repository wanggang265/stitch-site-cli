# stitch-site CLI

把 Stitch 导出的 `design-package.zip` 一键转换成可部署的 Next.js 站点。

## 功能

- 从 GitHub 模板 fork/clone 项目（默认使用 `wanggang265/nextjs-site-template`）
  - 如果模板 owner 是你的 GitHub 账号：自动创建新仓库并把模板内容 push 上去
  - 如果模板 owner 是他人：自动 fork 后 clone
  - 使用 `--skip-fork` 可跳过所有 GitHub 仓库操作，仅本地 clone
- 解压并解析 Stitch 设计包
- 把设计包页面映射为 Next.js App Router 路由
- 提取 design-system 颜色、字体并写入 `globals.css`
- 复制 `assets/` 到 `public/`
- 自动 `npm install` 与 `npm run build`

## 安装

```bash
git clone <repo> stitch-site-cli
cd stitch-site-cli
npm install
npm run build
npm link
```

## 使用

```bash
# 基础用法
stitch-site init design-package.zip my-project

# 跳过 fork、安装、构建
stitch-site init design-package.zip my-project --skip-fork --skip-install --skip-build

# 指定模板
stitch-site init design-package.zip my-project --template https://github.com/you/your-template.git
```

## 设计包格式

```
design-package.zip
├── home/
│   ├── code.html
│   └── screen.png
├── pricing/
│   ├── code.html
│   └── screen.png
├── contact/
│   ├── code.html
│   └── screen.png
├── design-system/
│   ├── colors.html
│   ├── typography.html
│   └── spacing.html
└── assets/
    ├── logo.svg
    └── favicon.ico
```

## 开发

修改 CLI 本身请先阅读 [`AGENTS.md`](./AGENTS.md)。

```bash
npm run dev -- init tests/fixtures/sample-design.zip tests/output/test-site
```

## 项目结构

```
src/
├── index.ts      # CLI 入口
├── template.ts   # fork/clone 模板
├── package.ts    # 解压与解析设计包
├── parser.ts     # HTML → TSX
├── mapper.ts     # 页面映射到 Next.js 路由
├── writer.ts     # design-system / assets 写入
├── utils.ts      # 工具函数
└── types.ts      # 类型定义
```
