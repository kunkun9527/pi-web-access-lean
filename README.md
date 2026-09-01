# @ssk_dev/pi-web-access-lean

> **Lean Pi web access plugin with identical features: 141 initialization tokens, 94% lighter than original.**
> [See my full setup for Pi](https://github.com/kunkun9527/my-lean-pi-setup)

[简体中文](README.zh-CN.md)

A lightweight Pi wrapper for [`pi-web-access`](https://github.com/nicobailon/pi-web-access). It preserves the full upstream web search and browsing engine while compressing four separate tools into a single, compact tool schema.

## Core Features

* Full upstream capabilities: Web search, result pagination, source verification, and page fetching all work as intended.
* Unified tool interface: Consolidates `web_search`, `source_check`, `fetch_content`, and `get_search_content` under one `web_access` tool.
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
| `fetch` | Fetch a URL | URL string |
| `get` | Continue a stored result | Response ID |
| `help` | Show full parameters | Operation name |

Simple example:

```json
{ "op": "search", "input": "Pi coding agent extensions" }
```

For batch or advanced parameters, pass a JSON object encoded as the `input` string. Use `help` only when you need the complete upstream schema.

## Context Footprint Benchmark

With only this extension enabled, its recurring initialization overhead in the model context is:

| Model-facing tool | Lean | Upstream `pi-web-access@0.22.0` |
| --- | ---: | ---: |
| Facade / search | `web_access`: 141 | `web_search`: 994 |
| Source checking | Included in facade | `source_check`: 413 |
| Content fetching | Included in facade | `fetch_content`: 576 |
| Result continuation | Included in facade | `get_search_content`: 393 |
| **Total** | **141** | **2,376** |

This saves **2,235 tokens (94.1%)** compared to the pinned upstream package.

The benchmark was measured on Pi 0.84.4 with `pi-context-view@0.4.3` in a fresh isolated session, excluding built-in tools, skills, context files, and unrelated extensions. Context View estimates tokens as `ceil(characters / 4)`. Pure runtime UI elements and slash commands are excluded as they are not sent to the model.

## Versions

Upstream runtime is pinned to `pi-web-access@0.22.0`.

## Development

```bash
npm ci
npm run check
```

## License

MIT. This project wraps the MIT-licensed [`pi-web-access`](https://github.com/nicobailon/pi-web-access).