# @ssk_dev/pi-web-access-lean

> **Pi 联网插件精简版，保留全部功能，仅需 141 初始化 Token，相比原版减少 94%。**
> **完整配置参考：** [查看 Pi Lean Setup](https://github.com/kunkun9527/my-lean-pi-setup)

[English](README.md)

基于 [`pi-web-access`](https://github.com/nicobailon/pi-web-access) 的精简封装。在完整保留上游网络检索能力的同时，将原本分散的 4 个工具整合成单一紧凑接口，大幅节省 Prompt 空间。

## 核心特性

* 保留全部联网功能：支持网页搜索、结果翻页续取、事实与来源核验、网页全文抓取。
* 统一工具入口：将 `web_search`、`source_check`、`fetch_content` 和 `get_search_content` 整合为一个 `web_access` 工具。
* 按需展开高级选项：日常查询只需传入简短字符串；复杂参数可传 JSON，完整 Schema 仅在调用 `help` 时按需提供，避免常驻占用上下文。

## 安装

```bash
pi install npm:@ssk_dev/pi-web-access-lean
```

请勿与其它 `pi-web-access` 包装插件同时加载，以防重复注册工具。

## 使用方法

模型仅会看到一个工具：

```text
web_access
```

| `op` 操作 | 说明 | `input` 输入 |
| --- | --- | --- |
| `search` | 网页搜索 | 查询关键词字符串 |
| `check` | 事实或来源核验 | 待核验内容字符串 |
| `fetch` | 抓取网页内容 | 目标 URL 字符串 |
| `get` | 续取已缓存结果 | 对应的 Response ID |
| `help` | 查看完整参数说明 | 目标操作名称 |

基础调用示例：

```json
{ "op": "search", "input": "Pi coding agent extensions" }
```

如需使用高级参数或批量操作，请将 JSON 对象序列化后作为 `input` 字符串传入。仅在需要查看完整上游 Schema 时调用 `help`。

## 初始化上下文占用对比

单独启用本插件时，注入到模型初始上下文中的 Token 占用实测如下：

| 模型可见工具 | Lean 精简版 | 原版 `pi-web-access@0.22.0` |
| --- | ---: | ---: |
| Facade / 搜索 | `web_access`: 141 | `web_search`: 994 |
| 来源核验 | 已收敛至统一工具中 | `source_check`: 413 |
| 网页抓取 | 已收敛至统一工具中 | `fetch_content`: 576 |
| 结果续取 | 已收敛至统一工具中 | `get_search_content`: 393 |
| **合计** | **141** | **2,376** |

相比固定版本的上游扩展，初始开销减少了 **2,235 tokens（94.1%）**。

测试环境为 Pi 0.84.4 与 `pi-context-view@0.4.3` 独立会话，排除了 Pi 内置工具、Skills、上下文文件与无关扩展。Context View 按 `ceil(字符数 / 4)` 估算。未计入不会发送给模型的纯运行时 UI 与 Slash 命令。

## 版本说明

上游运行时锁定为 `pi-web-access@0.22.0`。

## 本地开发

```bash
npm ci
npm run check
```

## 开源协议与致谢

MIT 协议。本项目封装自采用 MIT 协议的 [`pi-web-access`](https://github.com/nicobailon/pi-web-access)。