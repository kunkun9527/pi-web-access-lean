# @ssk_dev/pi-web-access-lean

<!-- token-benchmark:summary:start -->
> **Token 基准：Lean 152，上游 `pi-web-access@0.29.0` 2,899，减少 94.8%。**
<!-- token-benchmark:summary:end -->
> **完整配置参考：** [查看 Pi Lean Setup](https://github.com/kunkun9527/my-lean-pi-setup)

[English](README.md)

基于 [`pi-web-access`](https://github.com/nicobailon/pi-web-access) 的精简封装。在完整保留上游网络检索能力的同时，将原本分散的 4 个工具整合成单一紧凑接口，大幅节省 Prompt 空间。

## 核心特性

* 保留全部联网功能：支持网页搜索、结果翻页续取、事实与来源核验、网页全文抓取。
* 统一工具入口：将 `web_search`、`source_check`、`fetch_content` 和 `get_search_content` 整合为一个 `web_access` 工具。
* 新增本地 PDF 直接读取：支持直接抓取本地 PDF 文件（`op: "fetch"` 支持 `R:/doc.pdf`、Windows 盘符路径、`file:///` 协议及相对路径），突破了原版上游因 SSRF 防护而无法直接读取本地文件的限制，自动将 PDF 提取并持久化为结构化 Markdown 文档。
* 按需展开高级选项：日常查询只需传入简短字符串；复杂参数可传 JSON，完整 Schema 仅在调用 `help` 时按需提供，避免常驻占用上下文。

## 安装

```bash
pi install npm:@ssk_dev/pi-web-access-lean
```

请勿与其它 `pi-web-access` 包装扩展同时加载，以防重复注册工具。

## 使用方法

模型仅会看到一个工具：

```text
web_access
```

| `op` 操作 | 说明 | `input` 输入 |
| --- | --- | --- |
| `search` | 网页搜索 | 查询关键词字符串 |
| `check` | 事实或来源核验 | 待核验内容字符串 |
| `fetch` | 抓取网页或本地 PDF | 目标 URL 或本地 PDF 路径 |
| `get` | 续取已缓存结果 | 对应的 Response ID |
| `help` | 查看完整参数说明 | 目标操作名称 |

基础调用示例：

```json
{ "op": "search", "input": "Pi coding agent extensions" }
```

如需使用高级参数或批量操作，请将 JSON 对象序列化后作为 `input` 字符串传入。仅在需要查看完整上游 Schema 时调用 `help`。

## 初始化上下文占用对比

<!-- token-benchmark:benchmark:start -->
单独启用本扩展时，模型可见的常驻初始化上下文如下：

| 版本 | 工具与 Prompt 构成 | 合计 |
| --- | --- | ---: |
| Lean `@ssk_dev/pi-web-access-lean@0.29.0` | `web_access` (152) | **152** |
| 上游 `pi-web-access@0.29.0` | `web_search` (1,242) + `source_check` (533) + `fetch_content` (712) + `get_search_content` (412) | **2,899** |

节省 **2,747 tokens（94.8%）**。
测量环境为 Pi 0.85.1 的独立临时进程与空白配置。排除内置工具、Skills、上下文文件、消息、无关扩展、运行时 UI 与 Slash Commands；Token 按 `ceil(字符数 / 4)` 估算。
<!-- token-benchmark:benchmark:end -->

## 版本说明

上游运行时锁定为 `pi-web-access@0.29.0`。

## 本地开发

```bash
npm ci
npm run check
```

## 开源协议与致谢

MIT 协议。本项目封装自采用 MIT 协议的 [`pi-web-access`](https://github.com/nicobailon/pi-web-access)。