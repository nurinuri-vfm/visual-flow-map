# Data Schema

[日本語版 → data-schema.ja.md](data-schema.ja.md)

This shape stays consistent all the way from when extraction agents write it, through `build.js` reading it, to where it lands in the template's `const DATA`.

## Overview

```jsonc
{
  "nodes": [ { "id": "...", "lane": "...", "label": "...", "detail": "...", "ref": "..." } ],
  "edges": [ { "from": "...", "to": "...", "label": "...", "kind": "..." } ],
  "flows": [ {
    "id": "...", "title": "...", "category": "...", "trigger": "...",
    "steps": [ { "from": "...", "to": "...", "label": "...", "branch": "main" } ],
    "notes": [ "..." ]
  } ]
}
```

## nodes

| Field | Required | Description |
|---|---|---|
| `id` | ● | Unique. Lowercase ASCII, dot-separated. The prefix should match the `lane`. |
| `lane` | ● | One of the values from the list below. Unknown values are coerced to `svc`. |
| `label` | ● | The short noun phrase shown in the node box. 22 characters or fewer — longer text wraps to two lines and gets clipped. |
| `detail` | | The description shown on hover and in the step list. 120 characters or fewer. Describe conditions and failure behavior. |
| `ref` | ● | `repo-relative-path:line-number`. Used by the audit's existence check and for deduplication. In event-flow mode, use a source citation instead (e.g. `document-name#clause` / `interview:person`, etc. — see the terminology-mapping table in SKILL.md). |

If the same `id` appears in multiple files, `build.js` merges them. When it does, it keeps **the longer `detail` and the shorter `label`** (so it still fits in the box), and keeps whichever `ref` was filled in first.

## edges

| Field | Required | Description |
|---|---|---|
| `from` / `to` | ● | Node IDs. An edge pointing at a nonexistent ID is dropped as a broken reference. |
| `label` | | A short label shown on the route. Only displayed for the current step. |
| `kind` | | What the line represents: `call` / `http` / `mqtt` / `db` / `storage` / `push` / `email` / `timer` / `realtime` / `retry` / `error` |
| `evidence` | | The basis of an edge (evidence). `direct` (the call site exists in the source) / `inferred` (derived from types, DI, or a config string) / `framework` (framework-implicit — invoked by the framework, so no matching line exists) / `unverified` (the call target couldn't be identified). **Node `ref`s can be verified, but edges can't**, so this field declares the strength of the evidence instead. If the same route carries multiple declarations, the weaker one wins. The same field can also be set on `steps[]`. |

`edges` is the set of "relationships that exist in the system," while `flows[].steps` is "the order a given operation actually follows." The same hop can legitimately appear in both, and `build.js` takes the union. **Any hop that exists only in `steps` is automatically added to `edges`**, so during extraction it's enough to prioritize filling in `steps`.

## flows

| Field | Required | Description |
|---|---|---|
| `id` | ● | Lowercase letters and hyphens. The identifier for the operation/button. |
| `title` | ● | The text shown on the button. Write it in the user's words — e.g. "Press Start Training," not "Call trainSlot." |
| `category` | ● | The button's group. Decide on 8-10 per project and hand them out to all agents. |
| `trigger` | | Shown at the top of the right panel as "Operation: …". What gets pressed, or — if automatic — what triggers it. |
| `steps` | ● | An ordered list of edges. They light up one step at a time. |
| `notes` | | Notes shown at the bottom of the right panel: timeout values, `retained` behavior, what appears on screen on failure. |

### steps[].branch

| Value | Color | Meaning |
|---|---|---|
| `main` | Cyan | The happy path. Default if nothing else is specified. |
| `alt` | Amber | An alternate route taken under certain conditions (e.g. offline, cache hit). |
| `error` | Red (dashed) | Failure, retry, timeout. |

In a merged flow, `build.js` reorders steps as **main → alt → error**. This is because it's easier to read when the happy path is shown in full before the exceptions, and it also sidesteps the problem where an exception branch whose entry edge was never written ends up at depth 0 and gets sorted to the front.

## Lane List (Default)

| lane | Display Name | What Goes Here |
|---|---|---|
| `ui` | Screen / User Action | Buttons, screens, taps |
| `app` | Client Internals | Hooks, state management, API clients, screen components |
| `api` | API Handlers | The HTTP boundary (`net.http.*`) and handlers (`api.*`) |
| `svc` | Server Internals | Service layer, auth, validation, notification assembly |
| `job` | Scheduled / Background Jobs | cron, systemd timers, long-running loops |
| `db` | Database | Tables |
| `store` | Object Storage | Buckets |
| `mqtt` | Messaging (Queue / Topic) | Topics/queues such as MQTT, AMQP, SQS |
| `device` | Device / Edge | Edge-side modules |
| `hw` | Hardware | Physical devices such as sensors and cameras |
| `ext` | External Services | Push notifications, email, payments, etc. |

Lanes are drawn top to bottom in this order. To add or remove lanes for a given project, write `lanes` in the data directory's `meta.json` (don't edit the template). Event-flow mode (for subjects with no code) doesn't use this list at all — it's replaced entirely with lanes for the actors involved (people, organizations, records, external bodies). See "Event-Flow Mode" in SKILL.md.

## meta.json (Optional)

Place this in the data directory and `build.js` picks it up, embedding it as the diagram's configuration.

| Field | Description |
|---|---|
| `title` | The title shown in the tab and header. |
| `lanes` | `[{ key, label, color? }]`. Setting this replaces the lane list entirely. `key` must start with a lowercase letter and contain only alphanumerics, `-`, or `_`. If `color` is omitted, one is auto-assigned from the built-in palette. |
| `catOrder` | An array specifying the display order of categories. |
| `mode` | `"code"` (default) / `"event"` / `"concept"`. Since this changes **what order "lights up in sequence" refers to**, any mode other than `code` is called out explicitly in the diagram's subtitle. |
| `flowWord` | The term used in the UI (default 操作/"operation"; 事象/"event" in event-flow mode, 筋道/"path" in concept-map mode). |
| `lang` | `"en"` switches the UI strings (buttons, legend, help, badges) to English. Node and flow content stays in whatever language the author wrote it in. |
| `credit` | `false` hides the footer credit. |
| `creditUrl` | The link target for the credit. |

Passing `--repo` at build time automatically adds `meta.stamp`, which is shown in the legend. It includes the generation date, the commit, **the count of verified node refs** (`refScope: "node"`, to make explicit that routes are excluded from this check), and a breakdown of `evidence`.

`rt.*` (realtime subscriptions) and `net.http.*` don't have dedicated lanes. In practice, `rt.*` has been placed under `app` and `net.http.*` under `api`. Add a dedicated lane to `LANES` if you need one.

## How to Decide Naming Granularity

The basic rule is **one node = one function**. There are two exceptions, though.

- **"Things" like screens or tables** aren't functions, so name them after the entity instead: `ui.<screen>.<action>` / `db.<table>`
- If you're torn over **whether to split a node because the same function is invoked in essentially different ways**, don't split it. More nodes make the diagram harder to read, and dilute the value of reverse lookup.

Conversely, **you must split nodes** when — as with `uploader.upload_file` and `uploader.upload_wav` — they're actually different functions taking different routes. Even if the labels look similar, keep them as separate nodes when the `ref`s differ.
