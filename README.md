<div align="center">

# pi-web-access-lean

**Search, check and fetch the web from Pi, through one small tool.**

[简体中文](https://github.com/kunkun9527/pi-web-access-lean/blob/main/README_zh-CN.md) · Full setup: [My Lean Pi Setup](https://github.com/kunkun9527/my-lean-pi-setup)

</div>

<!-- token-benchmark:summary:start -->
> **Always-on context: 153 tokens vs. 1,165 for upstream `pi-web-access@0.47.0`, 86.9% less.**
<!-- token-benchmark:summary:end -->

A lean version of [`pi-web-access`](https://github.com/nicobailon/pi-web-access). It runs the upstream `0.47.0` engine as-is and folds its four tools into one `web_access` tool with a short schema.

## Install

```bash
pi install npm:@ssk_dev/pi-web-access-lean
```

Requires Pi `>=0.84.1` and Node.js `>=22.19.0`. Don't install it alongside upstream or another `pi-web-access` wrapper, or the tools get registered twice.

## Compared with upstream

**Kept**: web search, result pagination, source checking and page fetching, all from upstream's engine.

**Trimmed**:

- `web_search`, `source_check`, `fetch_content` and `get_search_content` become one `web_access` tool.
- Everyday calls take a plain string `input`; full schemas and advanced parameters stay out of the prompt until the model asks with `help`.

**Added**:

- **Local PDFs**: `op: "fetch"` reads local PDF files (`R:/doc.pdf`, Windows paths, `file:///...` and relative paths), which upstream's SSRF guard blocks. The extracted Markdown is saved locally with page and character counts.
- **Forgiving arguments**: a missing `op` is inferred from unambiguous fields (`responseId`, `url`/`urls`, `claim`, `query`/`queries`, or a bare URL/PDF path versus plain text). An object `input` is serialized, and upstream fields placed at the top level are merged into `input`; a field that disagrees with `input` is rejected, never silently dropped.

## Usage

The model sees one tool, `web_access`:

| `op` | Purpose | `input` |
| --- | --- | --- |
| `search` | Search the web | Query |
| `check` | Check a claim or source | Claim |
| `fetch` | Fetch a URL or local PDF | URL or PDF path |
| `get` | Continue a stored result | Response ID |
| `help` | Show full parameters | Operation name |

```json
{ "op": "search", "input": "Pi coding agent extensions" }
```

For batches or advanced parameters, pass a JSON object encoded as the `input` string.

## Token comparison

<!-- token-benchmark:benchmark:start -->
With only this extension enabled, what the model reads on every turn:

| Variant | Breakdown | Total |
| --- | --- | ---: |
| Lean `@ssk_dev/pi-web-access-lean@0.47.0` | `web_access` (153) | **153** |
| Upstream `pi-web-access@0.47.0` | `web_search` (338) + `source_check` (225) + `fetch_content` (372) + `get_search_content` (230) | **1,165** |

That is **1,012 tokens (86.9%)** less.

<sub>Method: Pi 1.4.0, each variant measured in its own temporary process with an empty working directory and configuration. Built-in tools, skills, context files, session history, user messages, other extensions, runtime UI and slash commands are not counted; `before_agent_start` additions are. Tokens are estimated as `ceil(characters / 4)`, not billed tokens.</sub>
<!-- token-benchmark:benchmark:end -->

## Development

```bash
npm ci
npm run check
```

## License

MIT. The runtime comes from [`pi-web-access`](https://github.com/nicobailon/pi-web-access) (MIT).
