# pi-web-access-lean

[中文](#中文) · [English](#english)

## 中文

`pi-web-access-lean` 是 [`pi-web-access`](https://github.com/nicobailon/pi-web-access) 的轻量 Pi 包装层。它保留上游联网、搜索、来源核验、抓取和结果续取逻辑，把多个详细工具收拢为一个小 schema；完整操作参数可通过 `help` 按需查看。

### 模型可见工具

- `web_access`

`web_access` 的 `op` 为 `search`、`check`、`fetch`、`get` 或 `help`。普通输入直接放在 `input`；高级参数使用 JSON 字符串。

### 安装

```bash
pi install git:github.com/kunkun9527/pi-web-access-lean
```

不要和原版 `pi-web-access` wrapper 同时加载，以免重复注册联网工具。

### 开发

```bash
npm ci
npm run check
```

上游依赖固定为 `pi-web-access@0.22.0`。

## English

`pi-web-access-lean` is a small Pi wrapper around [`pi-web-access`](https://github.com/nicobailon/pi-web-access). It keeps the upstream search, source-checking, fetching, and result-continuation behavior while routing the detailed operations through one small schema; complete operation parameters are available on demand through `help`.

It exposes one model-facing tool, `web_access`, with `op` values `search`, `check`, `fetch`, `get`, and `help`. Put simple input in `input`; use a JSON string for advanced parameters.

Install:

```bash
pi install git:github.com/kunkun9527/pi-web-access-lean
```

Do not load another `pi-web-access` wrapper at the same time, or the web tools may be registered twice.

Validate locally with `npm ci && npm run check`.

## License

MIT. This project is a wrapper around the MIT-licensed `pi-web-access` project.
