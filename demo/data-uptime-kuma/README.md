# Input data for the Uptime Kuma flow map

Everything that went into generating `demo/uptime-kuma-flow-map.html`.

The subject is [Uptime Kuma](https://github.com/louislam/uptime-kuma) v2.5.0 (commit `b980621`).
**The subject code is not bundled in this repository** (21.5k lines of server plus 33.5k lines of UI —
far too large to carry as a demo). To reproduce the ref verification yourself, clone the subject and point
`--repo` at it.

```bash
git clone --depth 1 https://github.com/louislam/uptime-kuma.git /tmp/uk
node ../../skills/visual-flow-map/scripts/audit.js --data . --repo /tmp/uk
node ../../skills/visual-flow-map/scripts/build.js --data . --out out.html --repo /tmp/uk
```

(Line numbers shift between commits. On anything other than the commit above, ref verification will not reach 100%.)

## What is in here

| File | Contents |
|---|---|
| `a-auth` … `h-public` (8 files) | The raw data eight agents extracted, one area each. The last five carry `evidence` (the basis for each edge) on every step; the first three were extracted before evidence was introduced, so theirs is undeclared |
| `z-fixes.json` | Nodes the adversarial review found missing (`patches.js` can only amend existing nodes, hence a separate file) |
| `aliases.js` | The six ID splits audit [1] reported. Each was folded only after opening the real code and confirming they were the same thing |
| `patches.js` | The errors two adversarial reviewers pinned down. **Each entry keeps a comment explaining why it was corrected**, so the same fixes can be re-applied after a future re-extraction |
| `meta.json` | Title, lanes, category order |

## What this extraction turned up

Beyond the corrections recorded in `patches.js`, it also surfaced problems in the subject project itself
(they are written into the map's notes).

- Deleting a monitor that does not exist, or that you do not own, throws nothing and returns `{ok:true, msg:"successDeleted"}`
- Editing a monitor reads `bean.user_id` with no null check when the target does not exist
- Destructive operations (clearing history, clearing statistics, shrinking the DB) have no password re-check
- Save on the settings screen never passes `currentPassword`, which makes `doubleCheckPassword` effectively unreachable when authentication is being disabled
- `clearHeartbeats` deletes the statistics tables (minute/hour/day) too, despite its name
- `getMonitorBeats` is implemented on both ends, but nothing calls it
