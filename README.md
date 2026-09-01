# pi-web-access-lean

> **Lean Pi web access plugin, same functionality — only ~141 vs ~2,376 initialization tokens.**
> [See my full setup for Pi](https://github.com/kunkun9527/my-lean-pi-setup)

[简体中文](README.zh-CN.md)

A token-lean Pi facade over [`pi-web-access`](https://github.com/nicobailon/pi-web-access). It keeps the complete upstream web runtime while presenting one compact model-facing schema.

## What it keeps

- Web search and result continuation.
- Source and claim checking.
- URL fetching and upstream provider behavior.
- Complete advanced operation schemas, disclosed locally through `help` only when needed.

## Why it is lean

Instead of exposing four detailed provider-facing tools on every request, the wrapper routes them through one `web_access` tool. Simple calls use a short string; advanced parameters remain available as JSON without keeping every operation schema in the prompt.

## Install

```bash
pi install git:github.com/kunkun9527/pi-web-access-lean
```

Do not load another `pi-web-access` wrapper at the same time, or web tools may be registered twice.

## Use

The model sees one tool:

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

For batch or advanced parameters, pass a JSON object encoded as the `input` string. Use `help` only when the complete upstream schema is required.

## Measured initialization footprint

With only this extension enabled, its recurring model-facing initialization contribution is:

| Model-facing tool | Lean | Upstream `pi-web-access@0.22.0` |
| --- | ---: | ---: |
| Facade / search | `web_access`: 141 | `web_search`: 994 |
| Source checking | Included in facade | `source_check`: 413 |
| Content fetching | Included in facade | `fetch_content`: 576 |
| Result continuation | Included in facade | `get_search_content`: 393 |
| **Total** | **141** | **2,376** |

That is **2,235 fewer tokens (94.1%)** than the pinned upstream extension. The measurement used Pi 0.84.4 and `pi-context-view@0.4.3` in a fresh isolated session, excluding Pi built-in tools, skills, context files, messages, and unrelated extensions. Context View estimates text as `ceil(characters / 4)`, so these are reproducible context-footprint estimates rather than exact GPT tokenizer counts. Runtime-only UI and slash commands are not included because they are not sent to the model.

## Versions

The upstream runtime is pinned to `pi-web-access@0.22.0`.

## Development

```bash
npm ci
npm run check
```

## License and upstream

MIT. This project wraps the MIT-licensed [`pi-web-access`](https://github.com/nicobailon/pi-web-access).