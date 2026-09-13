# @ssk_dev/pi-web-access-lean

> **Lean Pi web access extension with full features: 152 initial tokens (94.8% fewer than current upstream).**
> [See my full setup for Pi](https://github.com/kunkun9527/my-lean-pi-setup)

[简体中文](README.zh-CN.md)

A lightweight Pi wrapper for [`pi-web-access`](https://github.com/nicobailon/pi-web-access). It preserves the full upstream web search and browsing engine while compressing four separate tools into a single, compact tool schema.

## Core Features

* Full upstream capabilities: Web search, result pagination, source verification, and page fetching all work as intended.
* Unified tool interface: Consolidates `web_search`, `source_check`, `fetch_content`, and `get_search_content` under one `web_access` tool.
* Direct local PDF extraction: Supports fetching local PDF documents directly (`op: "fetch"` with paths such as `R:/doc.pdf`, Windows paths, and `file:///...`), which is blocked in upstream by SSRF guards. Extracted Markdown is saved locally with page and character counts.
* Minimal prompt overhead: Everyday operations use concise string inputs. Detailed schemas and advanced parameters stay out of the prompt until queried via `help`.

## Installation

```bash
pi install npm:@ssk_dev/pi-web-access-lean
```

Do not load this alongside another `pi-web-access` wrapper to avoid duplicate tool registrations.

## Usage

The model interacts with a single tool:

```text
web_access
```

| `op` | Purpose | `input` |
| --- | --- | --- |
| `search` | Search the web | Query string |
| `check` | Check a claim or source | Claim string |
| `fetch` | Fetch a URL or local PDF | URL or local PDF path |
| `get` | Continue a stored result | Response ID |
| `help` | Show full parameters | Operation name |

Simple example:

```json
{ "op": "search", "input": "Pi coding agent extensions" }
```

For batch or advanced parameters, pass a JSON object encoded as the `input` string. Use `help` only when you need the complete upstream schema.

## Context Footprint Benchmark

With only this extension enabled, its recurring initialization overhead in the model context is:

| Model-facing tool | Lean | Upstream `pi-web-access@0.29.0` |
| --- | ---: | ---: |
| Facade / search | `web_access`: 152 | `web_search`: 1,242 |
| Source checking | Included in facade | `source_check`: 533 |
| Content fetching | Included in facade | `fetch_content`: 712 |
| Result continuation | Included in facade | `get_search_content`: 412 |
| **Total** | **152** | **2,899** |

This saves **2,747 tokens (94.8%)** compared to the current upstream package.
The benchmark was measured on Pi 0.85.1 with `measure-plugin-tokens-v3.mjs` in a fresh isolated session, excluding built-in tools, skills, context files, and unrelated extensions. Token estimates use `ceil(characters / 4)`. Pure runtime UI elements and slash commands are excluded as they are not sent to the model.

## Versions

Upstream runtime is pinned to `pi-web-access@0.29.0`.

## Development

```bash
npm ci
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`pi-web-access`](https://github.com/nicobailon/pi-web-access).