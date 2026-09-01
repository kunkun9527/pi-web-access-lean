# pi-web-access-lean

> **Lean Pi web access 插件，功能相同：约 141 vs 2,376 个初始化 tokens。**
> **整套配置：** [查看 Pi Lean Setup](https://github.com/kunkun9527/my-lean-pi-setup)

[English](README.md)

[`pi-web-access`](https://github.com/nicobailon/pi-web-access) 的 token 精简版 Pi facade。它保留完整的上游联网运行时，同时只向模型提供一个紧凑 schema。

## 保留的能力

- 网页搜索和结果续取。
- 来源与事实声明核验。
- URL 抓取和上游供应商行为。
- 完整高级操作 schema，仅在需要时通过 `help` 在本地披露。

## 为什么更精简

包装层不再让每次请求都携带四个详细的模型可见工具，而是通过一个 `web_access` 工具路由这些能力。简单调用只使用短字符串；高级参数仍可通过 JSON 使用，无需长期把每个操作 schema 放入提示词。

## 安装

```bash
pi install git:github.com/kunkun9527/pi-web-access-lean
```

不要同时加载另一个 `pi-web-access` 包装层，否则联网工具可能被重复注册。

## 使用

模型只看到一个工具：

```text
web_access
```

| `op` | 作用 | `input` |
| --- | --- | --- |
| `search` | 搜索网页 | 查询字符串 |
| `check` | 核验声明或来源 | 声明字符串 |
| `fetch` | 抓取 URL | URL 字符串 |
| `get` | 续取已保存结果 | Response ID |
| `help` | 显示完整参数 | 操作名称 |

简单示例：

```json
{ "op": "search", "input": "Pi coding agent extensions" }
```

批量或高级参数应把 JSON 对象编码为 `input` 字符串。仅在需要完整上游 schema 时使用 `help`。

## 实测初始化上下文占用

仅启用本扩展时，它持续贡献给模型的初始化上下文为：

| 模型可见工具 | Lean | 上游 `pi-web-access@0.22.0` |
| --- | ---: | ---: |
| Facade / 搜索 | `web_access`：141 | `web_search`：994 |
| 来源核验 | 已包含在 facade 中 | `source_check`：413 |
| 内容抓取 | 已包含在 facade 中 | `fetch_content`：576 |
| 结果续取 | 已包含在 facade 中 | `get_search_content`：393 |
| **合计** | **141** | **2,376** |

相比固定版本的上游扩展，减少 **2,235 tokens（94.1%）**。测量使用 Pi 0.84.4 和 `pi-context-view@0.4.3`，在全新隔离会话中只启用目标扩展，并排除 Pi 内置工具、skills、context files、消息及无关扩展。Context View 按 `ceil(字符数 / 4)` 估算，因此这些是可复现的上下文占用估值，不是 GPT tokenizer 的精确计数。未计入不会发送给模型的纯运行时 UI 和 slash commands。

## 版本

上游运行时固定为 `pi-web-access@0.22.0`。

## 开发

```bash
npm ci
npm run check
```

## 许可证与上游

MIT。本项目包装了采用 MIT 许可证的 [`pi-web-access`](https://github.com/nicobailon/pi-web-access)。