# pi-web-access-lean

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

## Versions

The upstream runtime is pinned to `pi-web-access@0.22.0`.

## Development

```bash
npm ci
npm run check
```

## License and upstream

MIT. This project wraps the MIT-licensed [`pi-web-access`](https://github.com/nicobailon/pi-web-access).