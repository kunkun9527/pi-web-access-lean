<div align="center">

# pi-web-access-lean

**在 Pi 里搜索、核验、抓取网页，只用一个小工具。**

[English](README.md) · 完整配置：[My Lean Pi Setup](https://github.com/kunkun9527/my-lean-pi-setup)

</div>

<!-- token-benchmark:summary:start -->
> **常驻上下文：Lean 153 tokens，上游 `pi-web-access@0.47.0` 1,165 tokens，少 86.9%。**
<!-- token-benchmark:summary:end -->

[`pi-web-access`](https://github.com/nicobailon/pi-web-access) 的精简版。运行时直接用上游 `0.47.0`，我只把它的四个工具合成一个 `web_access`，说明也写得更短。

## 安装

```bash
pi install npm:@ssk_dev/pi-web-access-lean
```

需要 Pi `>=0.84.1`、Node.js `>=22.19.0`。不要和上游或其他 `pi-web-access` 包装同时安装，否则工具会注册两次。

## 和上游比

**保留**：网页搜索、结果翻页、来源核验和网页抓取，全部由上游运行时完成。

**精简**：

- `web_search`、`source_check`、`fetch_content`、`get_search_content` 合成一个 `web_access` 工具。
- 日常调用只传一个字符串 `input`；完整 schema 和高级参数不常驻，模型用 `help` 查询时才展开。

**新增**：

- **读本地 PDF**：`op: "fetch"` 能直接读本地 PDF（`R:/doc.pdf`、Windows 盘符路径、`file:///...` 和相对路径），上游的 SSRF 防护会拦下这类请求。提取出的 Markdown 保存在本地，并给出页数和字符数。
- **参数容错**：漏传 `op` 时按无歧义的字段推断（`responseId`、`url`/`urls`、`claim`、`query`/`queries`，只有 `input` 时按 URL/PDF 路径还是普通文本区分）。`input` 传成对象时自动转成 JSON 字符串；放在顶层的上游字段会合并进 `input`，和 `input` 里的值冲突时直接报错，不会悄悄丢掉。

## 用法

模型只看到一个 `web_access` 工具：

| `op` | 用途 | `input` |
| --- | --- | --- |
| `search` | 网页搜索 | 关键词 |
| `check` | 核验说法或来源 | 待核验的说法 |
| `fetch` | 抓取网页或本地 PDF | URL 或 PDF 路径 |
| `get` | 续取已保存的结果 | Response ID |
| `help` | 查看完整参数 | 操作名 |

```json
{ "op": "search", "input": "Pi coding agent extensions" }
```

批量或高级参数：把 JSON 对象序列化成字符串，作为 `input` 传入。

## Token 对比

<!-- token-benchmark:benchmark:start -->
只启用这一个扩展时，模型每轮都会读到的内容：

| 版本 | 构成 | 合计 |
| --- | --- | ---: |
| Lean `@ssk_dev/pi-web-access-lean@0.47.0` | `web_access` (153) | **153** |
| 上游 `pi-web-access@0.47.0` | `web_search` (338) + `source_check` (225) + `fetch_content` (372) + `get_search_content` (230) | **1,165** |

少 **1,012 tokens（86.9%）**。

<sub>测量方式：Pi 1.4.0，每个版本在独立的临时进程里测，工作目录和配置都是空的。不计内置工具、Skills、上下文文件、会话历史、用户消息、其他扩展、运行时 UI 和 Slash Commands；计入 `before_agent_start` 注入的内容。Token 按 `ceil(字符数 / 4)` 估算，不是实际计费值。</sub>
<!-- token-benchmark:benchmark:end -->

## 开发

```bash
npm ci
npm run check
```

## 协议与致谢

MIT。运行时来自 [`pi-web-access`](https://github.com/nicobailon/pi-web-access)（MIT）。
