---
name: visual-flow-map
description: Builds a single self-contained HTML flow map where pressing an operation — or a symptom — lights up only its path, step by step, and clicking any node shows everything that passes through it. Works on a codebase (agents read the real source; node refs are verified against it) and equally on things with no code: procedures, runbooks, product manuals, incident timelines. Use whenever someone wants to show how a system or a sequence of events flows across layers or actors — screens / API / DB / jobs, or people / teams / records / outside parties: "visualize the flow", "map the code paths", "diagram how this works", "architecture overview", "code map", "what happens when the user clicks X", "make our manual clickable", "troubleshooting guide", "flow or sequence diagram". Also use to rebuild an existing flow-map HTML. 日本語でも同じ（「処理フローを可視化」「導線を図にして」「業務フローを図解」「マニュアルを図にして」「システムの全体像」「フロー図がほしい」）。
---

# Build a Flow Map You Can Trace From Any Operation

[日本語版 → SKILL.ja.md](SKILL.ja.md)

## What This Builds

A single self-contained HTML file. No external CDN references — just double-click to open it.

- **Top**: buttons for user operations (grouped by category, searchable)
- **Bottom**: a node-link diagram laying out every process across lanes (screen / app-internal / API / internal processing / DB / storage / messaging / device / external service...)
- **On click**: only the path that operation takes lights up, step by step from its origin. Happy path = cyan, conditional branch = amber, failure/retry = red
- **Right side**: the steps are listed with `file:line` references
- **Reverse lookup**: clicking a process node shows the list of "operations that pass through this process"

This is where it differs from a sequence diagram. A sequence diagram draws one scenario along a time axis, so 100 scenarios mean 100 diagrams, and you can never answer "which operations pass through this function?" This format instead **overlays scenario paths on top of one static full map**, so you can look up shared nodes in reverse.

## When to Use This

**Good fit**: systems spanning multiple layers, 20+ operations, tracking down "I saved it but it's not showing up" type breaks in the chain, handing the full picture to a new team member.

**Poor fit**: small single-file, single-layer code (Mermaid is enough), when state transitions matter more than the processing itself (draw a state diagram instead), when you want a runtime profile (use a tracing tool instead).

## Three Modes

The same template is used three different ways depending on the subject. **Always record which mode you built in `meta.mode`** — it's displayed on the diagram itself, so the viewer knows what order "lights up step by step" actually refers to.

| Mode | `meta.mode` | Subject | Node | Lane | ref | What "lights up step by step" means |
|---|---|---|---|---|---|---|
| Code | `code` (default) | Repository | Functions, screens, tables | Technical layer | `path:line` | Execution order |
| Event | `event` | Business procedures, incident response, **manuals** | Events, actions, decisions | Actors (people, organizations, records) | `doc-name#section`, etc. | Order of occurrence |
| Concept | `concept` | A body of knowledge/concepts | Claims, concepts | Abstraction level (premise → core → implementation → operations) | `docs:`, `paper:`, `heuristic:`, etc. | **Order of understanding (not execution order)** |

The same visual language means something different in each mode, so without the mode label the viewer will misread it. See the sections below for details.

## Overall Flow

```
1. Scope it out        → skim the code and split it into "areas"
2. Extract in parallel → spin up one agent per area, have each write JSON
3. Audit                → audit.js. Sweeps for ID splits, dangling refs, duplicate flows
4. Merge and fix        → write aliases.js / merge.js / patches.js
5. Build and eyeball    → build.js → check with inspect.js and in the browser
```

Steps 3-5 never finish in one pass. Plan on 2-3 rounds of audit → fix → rebuild.

---

## 1. Scope It Out

Start by skimming the repo structure (`find`, routing definitions, entry points) and split it into **areas**. One area = one agent = one JSON file.

Cut areas along "layer × feature cluster." Example (for an e-commerce site):

| Key | Covers |
|---|---|
| `w-browse-order` | Frontend: product browsing, order screens |
| `w-account` | Frontend: auth, account page |
| `a-api-core` | API: all endpoints, payments, inventory |
| `a-jobs-notify` | API: job dispatch, notifications, scheduled tasks |
| `k-worker` | Worker: queue consumption, email, retries |

Rough sizing:

| Repository | Extraction agents | Verification agents |
|---|---|---|
| ~10k lines, 1 layer | 2-3 | 1 |
| Tens of thousands of lines, 2-3 layers | 5-8 | 2 |
| Large, 4+ layers | 8-12 | 3 |

Target roughly 6-15 flows per area. Fewer than that and the granularity is too coarse; more than that and a single agent's accuracy drops.

## 2. Extract in Parallel

`references/extraction-prompt.md` has a prompt template. **Don't hand it over as-is — rewrite the assigned area and hub IDs for this specific project first.**

There are three things that, if you cut corners on them at this phase, will collapse everything downstream.

### (a) Decide the shared node-ID convention first, and hand every agent the same one

This is the single most important thing. Agents can't see each other's work, so without a convention they'll assign different IDs to the same function — say, `dev.main.on_cmd` versus `dev.main._on_cmd`. The cross-layer path then **splits into two parallel rails that will never merge back together, no matter how much you consolidate later**.

The convention takes the form `<prefix>.<module>.<function>`, with the prefix mapped to a lane (`ui` / `app` / `net.http` / `api` / `svc` / `db` / `gcs` / `mqtt` / `dev` / `hw` / `ext` / `job` / `rt`).

On top of that, **list the actual names of layer-boundary nodes as "hub IDs" up front, and state explicitly that any path crossing them must use that exact string, character for character**. A boundary is any point that multiple areas necessarily touch — command dispatch, message topics, upload APIs, the shared HTTP client, subscription handlers, and the like.

Also decide up front that **function names must be written exactly as they appear in the source** (keep the leading underscore on private functions too) — that alone prevents a lot of drift before it starts.

### (b) Require a ref (`path:line`) on every node

This serves two purposes: it enables hallucination checking (`audit.js --repo` cross-checks refs against the actual file and line count), and it **becomes the key for identifying duplicate entities** (matching ref and lane strongly suggests the same thing). Without refs, almost none of the downstream auditing works.

### (b-2) Require every step to declare its evidence

**A node's ref can be verified against the actual file, but an edge saying "A calls B" has no mechanical way to be confirmed.** Testing against four real open-source projects found that in Go, roughly a fifth of edges appear nowhere in the source (ServeMux's route resolution, middleware's `next`, channels); in Rust, all 20 `FromRequest` guards — the actual mechanism behind authorization — were invisible to grep. Draw the line anyway without flagging it, and the diagram **lies exactly where it's most likely to be wrong**.

So every step must carry an `evidence` field. The call is not subjective — it's decided strictly by **whether the calling line actually exists in the source**.

| Value | Condition | How it renders |
|---|---|---|
| `direct` | The calling line exists in the source (can be pointed to with a ref) | Solid line |
| `inferred` | Derived from type/DI/config-string/event-name correspondence | Solid line + tagged in the step list |
| `framework` | The framework does the calling, so **no such line exists** | Dashed line + ◇ |
| `unverified` | Couldn't pin down the callee | Dotted line + **?** |

Have agents honestly mark `unverified` when they don't know. A guessed `direct` does more damage than an honest `unverified`. Unverified edges get listed at build time and funnel into a "check with someone who knows, then lock it in via patches.js" workflow. When the same edge gets multiple conflicting declarations, **the weaker one wins** — never make it look more certain than it is.

### (c) Have each agent write its own JSON file; keep the return value to a summary

Returning the full JSON body burns hundreds of thousands of tokens of the orchestrator's context. Have each agent Write to `<output-dir>/<key>.json`, and limit its return value to: the path it wrote, node count, list of flow IDs, and anything it wasn't confident about.

## 3. Audit

```bash
node <skill>/scripts/audit.js --data <json-dir> --repo <repo-root>
```

It reports on 7 categories. **[1] ID splits and [5] duplicate flows matter most.** Leave them unaddressed and the diagram's value evaporates — paths fracture, or the same operation ends up with 3-5 duplicate buttons.

Pass `--repo` and item [6] verifies that code refs actually exist. Until that reaches 100%, the diagram can't be trusted.

## 4. Merge and Fix

Write three files in the JSON directory; build.js picks them up automatically. All three are optional.

### aliases.js — collapse duplicate IDs assigned to the same entity

```js
module.exports = {
  'dev.main._on_cmd': ['dev.main.on_cmd'],      // 'canonical ID': ['alias to collapse', ...]
  'rt.events': ['app.lib.realtime.subscribeHistoryRealtime'],
};
```

audit.js item [1] surfaces candidates. But **don't mechanically collapse every one of them** — two things can reference the same line and still be genuinely different (two buckets pointing at the same constant-definition line, or `get` and `post` in the same file). For anything you decide not to collapse, leave a comment explaining why, so the next person doesn't have to re-litigate it.

### merge.js — merge one operation written up separately per layer into a single flow

```js
module.exports = [
  ['cancel-order', 'Order', 'Cancel an order',
    ['w-browse-order:cancel-order-click', 'a-api-core:api-cancel-order',
     'k-worker:refund-retry-job']],
];
```

Members are `<file-key>:<flowId>`. It stitches together, say, the "from button press to HTTP call" written by whoever owns the app with the "from receiving MQTT to returning a result" written by whoever owns the device, into one **end-to-end path**. Once merged, the original ordering no longer means anything, so build.js reorders it as "happy path → conditional branch → failure path, and within each group, by distance from the origin."

### patches.js — fix errors confirmed during verification

```js
module.exports = {
  dropEdges: [['dev.main._on_cmd', 'mqtt.event']],                   // remove an edge that doesn't match reality
  addEdges: [{ from: 'dev.main._publish_event', to: 'mqtt.event',
               label: 'publish kind=new at QoS1', kind: 'mqtt',
               flows: ['c-api-core:mqtt-event-inbound'] }],          // adding to flows also inserts it into the step list
  nodePatch: { 'api.user_promote': { detail: 'no caller from the app exists' } },
  flowPatch: { 'c-train:pull-update': { trigger: 'manual execution only', notesAdd: ['...'], notesDrop: ['cron'] } },
};
```

**The reason to keep fixes in patches.js instead of editing the JSON directly is to preserve the rationale for each fix.** Comment each entry with "why this was changed," and the same fix can be reapplied the next time you re-extract.

### Always run adversarial verification

Extraction agents get things wrong confidently. In one real run, after refining 10 areas, having 3 agents verify cross-layer connectivity turned up **19 factual errors at critical/high severity alone** — paths through UI buttons that don't exist, mixed-up dispatch targets, scripts that are never called, flows that loop back on themselves and go nowhere.

Instruct the verification agents as follows.

- Split themes into "one end-to-end chain" each (e.g., "does order → payment → async post-processing actually connect?")
- **Do not report "probably correct." Only report what you can pin down as wrong by looking at the actual source line.**
- Write fixes in a form that can be applied as-is: the correct node ID, the edge to add, the correct function name and line number.

## 5. Build and Eyeball It

```bash
node <skill>/scripts/build.js --data <json-dir> --out <output.html> --repo <repo-root>
```

Pass `--repo` and the result of cross-checking every node's ref against the actual files ("code refs n/m verified to exist"), the target commit, and the generation date get **stamped into the diagram's legend**. That lets whoever receives it check the diagram's freshness and trustworthiness on the spot, so always include it for code subjects (don't for event-flow mode).

Placing a `meta.json` in the data directory configures the diagram's appearance (every field is optional; it works without one):

```jsonc
{
  "title": "◯◯ Full Process Flow Map",   // tab and header title
  "catOrder": ["Auth", "Detection", "Maintenance"],  // category display order for the button groups
  "flowWord": "Operation",                // the term used in the UI. For event-flow mode, use "Event"
  "lang": "ja",                           // "en" switches UI strings (buttons, legend, help) to English
  "creditUrl": "https://…",              // link target for the footer credit (set credit: false to hide it)
  "lanes": [                              // if present, replaces the lanes entirely (see event-flow mode below)
    { "key": "staff", "label": "Field staff", "color": "#5b8cff" }
  ]
}
```

When regenerating (for a PR review or periodic update), pass the previous output HTML as `--diff-base`:

```bash
node <skill>/scripts/build.js --data <json-dir> --out flow-v2.html --repo <repo-root> --diff-base flow-v1.html
```

Added/changed nodes get a NEW/CHANGED badge, the flow list gets a "changes since last time" button (added paths light up; deletions and changes are listed in the notes), and the header shows a diff against the previous version. If nothing changed, it adds nothing and simply reports "no changes." This lets you show "what paths changed because of this" in 10 seconds, so always include it when regenerating.

What to check in the generated report:

- `DANGLING` is 0 (a leftover dangling reference breaks the path)
- `shared ids` is high enough — too few means layers aren't actually connected
- `no-ref` is 0
- the `merged` count matches what audit item [5] flagged

Then read through the content to confirm it.

```bash
node <skill>/scripts/inspect.js --html <output.html> --list           # flow list
node <skill>/scripts/inspect.js --html <output.html> --flow <flowId>  # display the steps in order (also detects breaks)
node <skill>/scripts/inspect.js --html <output.html> --node <nodeId>  # what's before/after the node, and which operations pass through it
```

`--flow` reports any point where "this step's origin never appeared in any earlier step" as a **break**. A break is a sign that "nobody wrote the entry edge," so add it via patches.js.

Finally, open it in a browser and replay a handful of representative operations. If possible, mechanically click through every flow to confirm step generation and highlighting don't break (in one real run, this checked all 105 flows).

---

## Event-Flow Mode (When the Subject Isn't a Codebase)

Build with the same template even for subjects with no code — business procedures, incident response, disaster response, manufacturing processes, historical timelines. Run steps 1-5 above with the substitutions below. **Don't improvise conventions on the spot — follow this section exactly.**

| Code subject | Event-flow subject |
|---|---|
| Lane = technical layer | Lane = actor (person, role, organization, location, record, external body). 5-9 of them |
| Node = function, screen, table | Node = event, action, decision, record. 1 node = 1 event |
| Flow (button) = user operation | Flow = scenario (normal course / conditional course / abnormal course) |
| Extraction source = actual code | Extraction source = manuals, regulations, reports, interviews, the user's account |
| Adversarial verification = cross-check against source lines | Cross-check against source documents, or review by parties involved / subject-matter experts |

### IDs, Hubs, and refs

- Same ID convention: `<lane-prefix>.<scene>.<event>` (lowercase ASCII). Map the prefix to the actor lane.
- Same as before: list the actual names of events that multiple scenarios necessarily pass through (notification, recording, handoff, approval, etc.) as hub IDs up front.
- **Read "ref" as "source citation."** If an actual file exists (regulations, meeting minutes in a repo, etc.), keep `path:line` and use `audit.js --repo` too. If not, **standardize every node** on one of: `doc-name#section`, `interview:person`, or `press:outlet date`. In that case, don't pass `--repo` (item [6] just gets skipped; every other audit still works). For nodes that are genuinely speculative with no source, mark "inferred" in the detail field.
- Source citations tend to get shared across multiple events, so audit item [1] (same ref, same lane) is a weak signal in event mode. Judge whether it's really the same event by its label and timing, not by mechanically collapsing matches.

### kind

Fine to omit (defaults to `call`). If you use it, stick to these: contact/notification = `call`, record/document = `db`, elapsed time/wait = `timer`, redo = `retry`, failure = `error`. `http` / `mqtt` / `storage` / `push` / `email` only when they refer to an actual system — don't repurpose them, e.g. don't call a phone call `mqtt`.

### Swapping Out Lanes (write it in meta.json — don't edit the template)

Write `lanes` in the data directory's `meta.json` and build.js replaces the lanes wholesale. Ordering them top to bottom as "the actor where it originates → the actor who responds → records → external" reads best.

```jsonc
{
  "title": "◯◯ Response Event Flow",
  "flowWord": "Event",
  "lanes": [
    { "key": "victim", "label": "Affected party" },
    { "key": "staff",  "label": "Field staff" },
    { "key": "lead",   "label": "Manager / decision-maker" },
    { "key": "record", "label": "Records / documents" },
    { "key": "comm",   "label": "Contact / notification" },
    { "key": "ext",    "label": "External body" }
  ]
}
```

- `key` becomes the ID prefix and the CSS variable name (must start with a lowercase English letter, only alphanumerics plus `-`/`_`; invalid keys get warned about and excluded at build time)
- `color` is optional (auto-assigned from the built-in 11-color palette). If you specify one: `"color": "#5b8cff"`
- Setting `flowWord: "事象"` replaces "Operation" throughout the UI (count display, search, list, reverse-lookup headings) with "Event"

### Scale

For a single theme (10 or fewer scenarios), skip area splitting, parallel extraction, and merge.js — write it with one agent and one JSON file. Beyond that (multiple event types, 20+ scenarios), cut areas along "event type × actor group" and run the same parallel process used for code subjects.

## When the Subject Is a Manual or Procedure Guide (a Variant of Event-Flow Mode)

**This is one of the subjects this format works best for.** Nobody reads a 300-page manual cover to cover. Set it up so pressing "Wi-Fi won't connect" lights up only that fix, step by step, and any step can look up "which symptoms pass through here" in reverse — that's faster to navigate than an index.

On top of the event-flow-mode conventions, also follow these:

- **Use the manual's own section numbers as the ref** (`User Guide#3.2`). Since manuals are already numbered, the equivalent of a code `file:line` already exists out of the box.
- **"Only if X" gets `branch: "alt"`; warnings and prohibitions get `branch: "error"` or go in notes**
- **In troubleshooting, branching is the main event.** A single scenario becomes a tree, so split flows by symptom ("X doesn't work," "X is slow").
- **Turning it into a flow exposes gaps in the manual** — branches where only one side is documented, steps whose prerequisites live only in a different chapter, conflicting descriptions of the same operation. Log whatever you find in notes. This isn't a side effect — it's fine to treat it as **the primary goal, a manual quality audit in its own right**.

## Concept-Map Mode (When the Subject Is a Body of Concepts or Knowledge)

`meta.mode: "concept"`. Treat this as a **separate mode**, not an extension of event-flow mode — the meaning of lanes, nodes, refs, and the visual staging all change.

1. **Cut lanes by abstraction level, not by actor** (e.g., `pre` premises / `core` fundamentals / `impl` implementation means / `ops` operations). **You may have one cross-cutting lane** (e.g., `trap` for pitfalls). Order them so reading top to bottom follows the order of understanding.
2. **A flow is not a timeline — it's a "line of reasoning."** Set `flowWord` to `"Thread"` or `"Question"`, and phrase the title as a question ("How do you prevent runaway behavior?"). In trigger, write "the situation where you'd follow this thread."
3. **Leave `kind` at its default and write the relationship type in the edge's label instead** (is a premise for / serves as a countermeasure to / results in / is a counterexample to). Restrict `branch` to: main = the main thread / alt = a side branch / error = falling into a pitfall.
4. **Allow cycles.** Steps that loop back to the same concept aren't a mistake. It's fine to ignore `inspect.js`'s break warnings in concept maps — not having a single fixed origin is normal here.
5. **Always write `edges` separately from `steps`.** Without the static relationships between concepts, the full map has no structure — one real case had 20 nodes and only 3 edges, and it collapsed into a pile of dots.
6. **Cap it at 20-40 nodes, and phrase labels as declarative statements** ("Output varies run to run"). Standardize refs on a source-type prefix. The same ref being shared across many nodes is normal here, so ignore audit item [1]'s flags.

**Poor fit**: order-less relationships like containment, classification, or contrast can't become arrows and get dropped entirely. If what you want is a mind map (radial, unordered), this isn't the format for it.

## Notes by Language and Codebase Structure

`references/language-notes.md` has the preconditions we verified by actually extracting from four real open-source projects (Go / Rust / Java microservices / TypeScript monorepo). **Hand extraction agents only the section for their assigned environment.** Every environment is "usable, with conditions" — the file spells out exactly what breaks if those conditions aren't met.

In particular, the default 7 lanes **don't fit any of these environments, and they're off in opposite directions depending on the environment** — Java needs deployment-unit lanes, Rust needs guard-and-model lanes, TS needs a server/browser boundary. Decide the lane design before you start.

## What This Format Can't Express

Structural limitations that no amount of extra instructions will fix. **Sometimes you need to explain these to whoever receives the diagram.**

1. **`steps` is a fully-ordered linear sequence.** It can't express parallelism (N workers at once, `Promise.all`), unordered arms (`select!`'s multiple branches), out-of-order completion (fire-and-forget), or repeat counts and intervals. And since the "lights up step by step" staging itself asserts a time order, a note can't undo that impression — flag the affected spots in notes explicitly.
2. **There's no vocabulary for "a node that exists only under certain conditions"** (`@Profile("production")`, feature flags, build-time branching). `branch: "alt"` is a branch in the path, not conditional existence of a node — write the activating condition in detail instead.
3. **One flow = one origin.** External requests merging into an always-on connection, or multiple protocol entry points into the same process, are structurally breaks. Don't paper over it with a fake edge — name the merging source explicitly in notes.
4. **Lanes can only express one axis** (technical layer / deployment unit / execution process / execution frequency are four independent axes). Whichever you pick, the other three vanish from the diagram.
5. **100% ref verification doesn't mean "the content is correct."** For external services, generated code, and classes from dependency libraries, you have no choice but to use a stand-in ref, and since the stand-in ref genuinely exists, it passes verification anyway. Whenever you use a stand-in, say so explicitly in detail.

## About the Template

`assets/template.html` is the renderer. JSON gets inserted at the `/*__FLOW_DATA__*/{nodes:[],edges:[],flows:[]}` marker. **You shouldn't need to touch it.** Title, lanes, category order, and terminology are all configured through `meta.json` (see "5. Build and Eyeball It" above). The only reasons to edit the template directly are switching UI strings to English, or changing node size/spacing (`NW` / `NH` / `COLW` / `ROWH`).

The generated HTML includes a first-open usage hint (shown once), `#flow=<flowId>` deep links (so you can share a URL with a specific path already selected), a legend stamp (generation date, commit, ref verification count), and a credit line.

The renderer has two views. **Route view** (the default) draws only the selected operation's subgraph in a hierarchical layout; the **full map** packs every node into a grid by lane and overlays the paths on top. Trying to draw the full map in a hierarchical layout blows the longest path past 100 tiers and the width past 20,000px, which is unusable — we hit this in practice. The split between these two views is deliberate, so don't ship only one of them.

## Common Failures

`references/pitfalls.md` covers 8 failures we actually hit in real runs, along with the fix for each. **Read it once before starting your second pass.** Four of them in particular — ID splits, duplicate flows written per layer, full-map width blowup, and step ordering — you will hit if you don't know about them going in.

## Reference Files

- `references/extraction-prompt.md` — the prompt template to hand to extraction agents (includes the ID convention, schema, and output instructions)
- `references/data-schema.md` — the complete schema for nodes / edges / flows, the lane list, and what `branch` and `kind` mean
- `references/pitfalls.md` — failures we actually hit in real runs, and their fixes
- `../../demo/` — three pre-built demos, plus their input data and the actual sample app they were built from
