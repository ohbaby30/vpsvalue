# VPS 剩余价值计算器

计算 VPS 剩余价值，支持 11 种货币、7 种付款周期、自动或手动汇率、SVG 分享卡片与 Markdown 图片链接。

## Cloudflare Workers + GitHub

1. 在 Cloudflare 的 **Workers & Pages → Create application → Import a repository** 选择这个仓库。
2. Worker 名称填 **vpsvalue**，与 `wrangler.jsonc` 一致。
3. 生产分支选 **main**，根目录留空，构建命令留空，部署命令填 **npx wrangler deploy**。
4. 点击 **Save and Deploy**，完成后访问 Cloudflare 提供的 `workers.dev` 网址。

不需要环境变量、数据库、KV 或应用 API Key。GitHub 与 Cloudflare 的部署授权在平台界面完成，不要将 Token 写进仓库。后续提交到 main 会由已连接的 Cloudflare 项目自动部署。

网页与静态资源由 Workers Assets 托管；Worker 提供 `/api/rates`、`/card` 与 `/health`。汇率响应在 Cloudflare Cache API 中缓存 6 小时，缓存按数据中心生效。分享卡片底部网址自动使用当前域名，卡片按 Asia/Shanghai 的生成当天计算。

本地开发需要 Node.js 22 或更新版本：

```bash
npm ci
npm run dev
```

## Docker Compose

仓库也保留 Docker 部署：

```bash
docker compose up -d --build
```

默认仅监听 `127.0.0.1:18086`。需要设置端口、监听地址或卡片网站地址时，将 `.env.example` 复制为 `.env` 后修改，再启动。

## 计算规则

- 年付周期按 365.25 天，其他周期按比例或倍数折算。
- 到期当天计入剩余天数，不对剩余价值设置总价上限。
- 分享链接不包含用户选择的交易日期，SVG 卡片按生成当天计算。
- 汇率获取失败时使用页面注明的备用估算值；汇率仅供折算参考。

字体 Inter 与日期选择器 flatpickr 已随网页提供本地资源；其许可位于 `public/assets/`。汇率源为 [Currency API](https://github.com/fawazahmed0/exchange-api)，采用 CC0 数据，使用独立上游，不依赖参考站接口。
