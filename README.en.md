# interactive-flow-map

**An Agent Skill that generates a single-file interactive HTML flow map — pick an operation (or an event) and watch only its path light up, step by step — extracted from your actual codebase by AI agents and mechanically verified.**

[日本語 README → README.md](README.md)

Works for software systems (UI → API → DB → workers → external services) and equally for real-world event flows (business procedures, incident timelines) with actor-based lanes.

## Why it's different

| Typical diagrams | This skill |
|---|---|
| Hand-drawn, stale the moment they ship | Agents read the code and extract; regeneration is cheap |
| "Probably correct" | Every node carries `file:line`, **verified against the repo**; the verification result (e.g. `22/22 refs verified · commit abc1234`) is stamped into the diagram itself |
| One sequence diagram per scenario | Scenario paths are overlaid on a single static map — click any shared node to **reverse-lookup every operation that passes through it** |
| Cloud SaaS that ingests your code | **One self-contained HTML file.** No CDN, no server, opens by double-click. Your code never leaves your machine |

## Demos (in `demo/`)

- [`demo/order-flow-map.html`](demo/order-flow-map.html) — code mode: a mini e-commerce app ([`demo/sample-app/`](demo/sample-app/)) with order / cancel / refund-retry / email flows across web, API, worker and DB layers. All 22 `file:line` refs verified
- [`demo/incident-flow-map.html`](demo/incident-flow-map.html) — event-flow mode: a nursery-school fever incident, with actor lanes (staff / nurse / contact / parent / records / clinic) instead of tech layers

In the diagram: click a flow button to replay its path · click a node for reverse lookup · share a specific path via `#flow=<id>` deep links · search, zoom, playback.

## Install

### Claude Code (as a plugin)

```bash
/plugin marketplace add <your-github-id>/interactive-flow-map
/plugin install interactive-flow-map
```

### Manual

```bash
git clone https://github.com/<your-github-id>/interactive-flow-map
cp -r interactive-flow-map/skills/interactive-flow-map ~/.claude/skills/
```

The skill follows the open [Agent Skills](https://agentskills.io) standard. Node.js is required for the build/audit scripts. Note: the skill instructions are in Japanese, but the generated diagram UI can be switched to English with `"lang": "en"` in `meta.json`.

## Use

```
Visualize the processing flows of this repository so I can trace what runs behind each user action.
```

The skill drives the whole pipeline: scope splitting → parallel extraction → audits (ID drift, dangling refs, ref existence) → adversarial verification → build. See [`skills/interactive-flow-map/SKILL.md`](skills/interactive-flow-map/SKILL.md).

## Manual build

```bash
node skills/interactive-flow-map/scripts/build.js \
  --data demo/data-code --out flow-map.html --repo demo/sample-app
```

`--repo` verifies every `file:line` ref and stamps the result into the diagram. A `meta.json` next to the data configures title, lanes and wording — no template editing.

## License

MIT
