# Failures We Actually Hit, and How We Fixed Them

[日本語版 → pitfalls.ja.md](pitfalls.ja.md)

All of these happened for real, on an actual project (three layers — mobile, cloud, and IoT device — 105 operations / 638 nodes).
They're listed roughly in order from most to least damaging.

---

## 1. ID Fragmentation — a Cross-Layer Route Splits into Two Parallel Rails

**Symptom**: Even after merging, "app → cloud → device" doesn't connect. On the diagram, there's a break in the chain partway through the route.

**Cause**: Extraction agent A named it `dev.main.on_cmd`; extraction agent B named it `dev.main._on_cmd`. Same function, but two separate nodes got created, so the route agent A built and the route agent B built never converge. In the real case there were **49 pairs of nodes with the same ref and the same lane but different IDs**.

**Fix**:
- State explicitly in the extraction prompt: "Use function names exactly as they appear in the real code — don't drop the leading underscore on private names." (This alone kills most of the problem.)
- For nodes that sit at a layer boundary, **enumerate them by their real name as hub IDs** and have every agent reuse them as-is.
- Whatever still slips through gets caught by check [1] in `audit.js` and merged in `aliases.js`.

**Don't over-merge**: Two nodes that point at the same line aren't necessarily the same thing. Cases we deliberately kept separate:
- `gcs.snapshots` and `gcs.samples` — same constant-definition line, but different buckets
- `ipv4_http.get` and `ipv4_http.post` — different functions
- `ui.settings.logout` and `ui.settings.logout_confirm` — the confirmation dialog is its own step
- "pull to refresh" on each screen — a distinct thing per screen

When in doubt, only merge nodes where **both the ref and the lane match, and the normalized function name matches too**. For anything you keep separate, leave the reason in a comment in aliases.js.

---

## 2. The Same Operation Shows Up as 3 to 5 Different Buttons

**Symptom**: The "capture now" button ends up as five separate entries: `capture-now` / `device-capture-now` / `capture-manual` / `manual-capture` / `api-capture`. Far from being obvious at a glance, you can't even tell which one to pick.

**Cause**: Five extraction agents each described the same operation from their own layer's point of view. This is the expected outcome, not an agent mistake.

**Fix**: Merge them with `merge.js`. In the real case this took **190 flows down to 105 operations**. Check [5] in `audit.js` surfaces the merge candidates.

Once flows are merged, their original ordering stops meaning anything, so build.js re-sorts them. Skip this re-sort and the error-handling branches end up at the front of the steps, producing a nonsensical diagram (see #4 below).

---

## 3. The Full Map Ends Up Over 20,000px Wide

**Symptom**: Laying out every node with a hierarchical (Sugiyama-style) layout produced a canvas 28,232 × 9,426 px. Zoomed out, the text is unreadable; zoomed in, you can't see the whole thing.

**Cause**: A hierarchical layout's width is driven by **the number of ranks in the longest route**. Taking the union of every flow, and then cutting cycles, produces a chain over 100 ranks deep.

**Fix**: Split rendering into two modes.
- **Route view (default)**: lay out only the subgraph for the selected operation hierarchically. That keeps the rank count to at most 15–25.
- **Full map**: pack all nodes **into a grid, per lane**, overlay the selected route on top, and dim everything else. Width scales with the square root of the node count, so this stays around 4,000px.

Check [7] in `audit.js` reports the estimated size for both modes. If the full map comes out way past 4,000px, your nodes are too fine-grained.

---

## 4. Step One of the Sequence Turns Out to Be "When It Times Out and Fails"

**Symptom**: Hit play, and the animation starts by lighting up the exception-handling path right away. The real starting point (pressing the button) shows up last.

**Cause**: The merged flow was ordered purely by "distance from the start." Error-path nodes that nobody wired an incoming edge to (e.g. `rec_watchdog.should_expire`) end up with in-degree 0, which reads as distance 0 — i.e., first.

**Fix**: Sort by `branch` as the primary key and distance as the secondary key. Ordering `main → alt → error` naturally pushes error branches with a missing entry edge to the back. Already implemented in build.js.

We also tried filtering by reachability, but that broke in a different way: **when the real starting node (the "start training" button) differs from the starting point of the flow's first merge member, it gets bumped all the way to the end.** Prioritizing `branch` is the more stable approach.

---

## 5. The Extraction Agent Gets It Confidently Wrong

**Symptom**: Plausible-looking routes that don't actually exist end up in the diagram.

**Real examples** (19 critical/high findings from three separate verification passes alone):
- **A UI button that doesn't exist**: drew a route as an operation the screen could trigger, but there wasn't a single client-side call for it (in reality it only ran as an automatic server-side process once a condition was met)
- **Wrong dispatch target**: wired every incoming message to a single command handler, but that handler actually only processed a subset of them — the rest of the message types were routed by a separate subscription handler
- **A script that's never called**: drew a round trip where "script A launches B," but there wasn't a single call to it anywhere in the real code — A was for manual operations only
- **A flow that ends in a self-loop**: the post-completion screen transition looped back to itself (in reality it was a replace-transition to the list screen)
- **Wrong queue**: mixed up the failure fallback destination with a similarly named but different table (different table, different DB)
- **Contradicting notes**: for the same feature, one file said "nothing propagates downstream," while another said "it takes effect on the next run" (the latter was correct)

**Fix**: Have a **separate agent from the one that did the extraction** verify each **end-to-end chain** one at a time — adversarial verification. The prompt for this is at the end of `extraction-prompt.md`. Write corrections into `patches.js` with supporting evidence, rather than editing the JSON directly.

---

## 6. Returning Raw JSON Blows Out the Context Window

**Symptom**: JSON for 10 areas (several hundred KB combined) floods straight into the orchestrator's context.

**Fix**: Have each extraction agent **write its output to a file with Write, and return only a summary**. The orchestrator can make its decisions just by reading the output of `audit.js` / `inspect.js`. In the real case, the extraction phase burned 2.7 million tokens total, but the orchestrator's own consumption stayed minimal.

---

## 7. Showing Every Edge Label at Once Makes It Unreadable

**Symptom**: Even when a route lights up, the labels overlap into an unreadable clump.

**Fix**: By default, show **only the label for the step that's currently lit**. Make "show all labels" an optional toggle. The label text also appears in the step list in the side panel, so there's no need to make people read everything directly off the diagram. Already implemented in the template.

---

## 8. Playback of a Long Flow Never Seems to End

**Symptom**: 101 steps × 850ms = 86 seconds. Nobody watches it to the end.

**Fix**: Auto-tune the per-step interval to `max(170ms, min(selected value, 28000 / step count))` so the whole playback fits in roughly 28 seconds. Already implemented in the template.

Even so, a flow with more than 60 steps is probably too big to be a single operation in the first place. Check [7] in `audit.js` flags these flows, so consider splitting them apart (e.g., making "start training" and "when training fails" separate buttons).

---

## Bonus: Easy-to-Miss Checks

- **Orphan nodes**: build.js automatically drops any node that doesn't appear on any edge. If you don't notice the drop, a process that should exist quietly disappears — always read `ORPHANS` in the report
- **The `shared ids` count**: how many IDs appear in more than one file. If this is low, the layers aren't actually connected to each other
- **`no-ref`**: the count of nodes with no code reference. If it's nonzero, the extraction was too loose
- **Existence check with `--repo`**: actually verify that each ref's file exists and that the line-number range is valid. Don't trust the map until this hits 100%
