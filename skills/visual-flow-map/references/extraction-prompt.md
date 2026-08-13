# Prompt Template for Extraction Agents

[日本語版 → extraction-prompt.ja.md](extraction-prompt.ja.md)

Copy the template below, fill in the `{{ }}` placeholders for your project, and hand it to each agent.
**Give every agent the same "shared section."** If this isn't consistent across agents, routes that cross layers won't merge.

---

## Shared Section (identical for every agent — distribute unmodified)

```
You will examine the code at {{absolute path to the repository}} and output,
for every user operation (or automatic trigger), which code runs in which order,
as a machine-readable graph JSON.

## Absolute Rules
- Never guess. Write only what you have confirmed by Reading / Grepping the actual files.
  Function names, endpoints, topic names, and table names must match the real thing character for character.
- Attach a ref ("path-relative-to-repo:line-number") to every node. The line number must be the definition
  line you actually confirmed. This field matters for both the downstream hallucination audit and duplicate
  detection, so always fill it in.
- Write function names exactly as they appear in the real code. Do not drop a leading underscore that marks
  something private (do not turn _on_cmd into on_cmd).
- label / detail are in {{language}}. label is a short noun phrase, 22 characters or fewer (short enough to
  fit in the diagram's node box). detail is 120 characters or fewer and describes concretely "what it does" —
  include conditions, branches, retries, and failure behavior.

## Node ID Naming Convention (lowercase, ASCII, dot-separated)
- ui.<screen>.<action>          Button the user presses / UI operation
- app.<module>.<function>       Client-side internals (hook, store, API client, screen component)
- net.http.<METHOD>_<path>      Client→server HTTP boundary. Replace / and - in the path with _
- api.<handler function name>   Server-side request handler
- svc.<module>.<function>       Server-side internal processing
- db.<actual table name>        Database
- gcs.<area>                    Object storage
- mqtt.<topic abbreviation>     Messaging (write the actual topic string in detail)
- dev.<module>.<function>       Device / edge side
- hw.<device>                   Physical device
- ext.<external>                External service
- job.<name>                    Scheduled / long-running process
- rt.<subscription target>      Realtime subscription

## Shared Hub IDs (if your assigned scope passes through one of these, use this exact spelling
character-for-character. Do not invent an alias.)
{{List here, by real name, the nodes that sit at layer boundaries. 5-15 of them. Example:
svc.mqtt_client.publish_command / mqtt.cmd / mqtt.cmdres / mqtt.event
dev.main._on_cmd / dev.uploader.upload
net.http.POST_upload / api.upload
app.lib.api.request / rt.events
}}

## lane values
{{The lanes for this project. Default is the following 11}}
"ui" / "app" / "api" / "svc" / "job" / "db" / "store" / "mqtt" / "device" / "hw" / "ext"

## flows (the unit that becomes a button)
- 1 flow = "one button the user presses" or "one automatic trigger."
- category must be chosen from the following: {{list of 8-10 categories. Example: Auth & initial setup /
  Ordering & purchase / Inventory & shipping / Settings changes / Notifications / History / Maintenance /
  Automated & scheduled processing}}
- steps is "an ordered sequence of edges." Each step is {from, to, label, branch}.
  branch is "main" (happy path) / "alt" (conditional branch / alternate route) / "error" (failure, retry,
  timeout).
- Always include the asynchronous return leg (e.g., the result comes back, the DB is updated, and the screen
  reflects it) in steps, and close the flow all the way to the end. Do not leave it one-way.
- In notes, write down "gotchas, timeout values, and what the user sees on failure."

## Output
1. Write the JSON file with Write to {{output directory}}/<KEY>.json.
   {"nodes":[{"id","lane","label","detail","ref"}...],
    "edges":[{"from","to","label","kind"}...],
    "flows":[{"id","title","category","trigger","steps":[{"from","to","label","branch"}...],"notes":[...]}]}
   kind is one of "call"/"http"/"mqtt"/"db"/"storage"/"push"/"email"/"timer"/"realtime"/"retry"/"error".
   flows[].id uses lowercase letters and hyphens. title is in {{language}}.
   edges must include every edge used in steps (duplicates are fine).
   nodes must include, without omission, every ID referenced by steps/edges.
   No trailing commas, no comments, no BOM. The file must always be parseable.
2. Keep the final text (your return value) short. Report only the file path you wrote, the node count, the
   edge count, the list of flow ids, and warnings about anything you weren't confident in. Do not return the
   JSON body itself.
   (Returning the body would overflow the orchestrator's context.)
```

## Per-Agent Section (replace this for each agent)

```
## Your assigned key <KEY> = "{{key}}"
## Assigned area: {{title}}
{{List the specific files you're responsible for, and describe what you want turned into flows.
 Accuracy improves when you spell out "which buttons must not be missed."}}

You may also read files outside your assigned scope, to the extent needed to create boundary nodes where a
flow crosses layers. However, leave the detailed internal expansion to the owning agent, and connect via the
shared hub IDs.
Produce at least 6 flows, ideally 10 or more. Do not miss any button the user can press.
```

## Structured Output Schema (for the return value)

If you can constrain the agent's return value by type, use the following.

```json
{
  "type": "object",
  "required": ["file", "nodeCount", "edgeCount", "flowIds"],
  "properties": {
    "file":       {"type": "string"},
    "nodeCount":  {"type": "number"},
    "edgeCount":  {"type": "number"},
    "flowIds":    {"type": "array", "items": {"type": "string"}},
    "hubIdsUsed": {"type": "array", "items": {"type": "string"}},
    "warnings":   {"type": "array", "items": {"type": "string"}}
  }
}
```

Do not take `warnings` lightly. In a real case, the extraction agent itself wrote in a warning that "the
button for that operation does not exist on the screen side (zero grep hits)" — and that was later
reconfirmed as a critical finding during verification.

---

## Prompt for the Verification Agent

Once extraction is done, have **a different agent** verify it. Having the same agent that did the extraction
verify its own work will not surface the flaws.

```
You are an adversarial reviewer verifying the flow-graph JSON files for {{repository}}.
The JSON files live in {{output directory}}/ under the following keys: {{file list}}
Each file has the form {"nodes":[...], "edges":[...], "flows":[...]}.

Read whichever JSON files you need, cross-check them against the real code in the repository, and surface
factual errors, breaks in the chain, and ID inconsistencies.
Do not report "probably correct." Report only what you can confirm as wrong by checking the actual line of
code.
Write proposed fixes in a concrete, directly-applicable form (the correct node ID / the edge that needs to
be added / the correct function name and line number).

Verification theme: {{Specify one end-to-end chain. Example:
  Whether "order → payment → asynchronous post-processing" is actually connected at the node-ID level.
  Enumerate breaks in the chain (one side created an ID that the other side recreated under a different
  name / the return leg is missing).}}
```

Return value schema:

```json
{
  "type": "object",
  "required": ["issues"],
  "properties": {
    "issues": {"type": "array", "items": {
      "type": "object",
      "required": ["severity", "where", "problem", "fix"],
      "properties": {
        "severity": {"enum": ["critical", "high", "medium", "low"]},
        "where":    {"type": "string"},
        "problem":  {"type": "string"},
        "fix":      {"type": "string"},
        "evidence": {"type": "string"}
      }}},
    "missingFlows":    {"type": "array", "items": {"type": "string"}},
    "danglingNodeIds": {"type": "array", "items": {"type": "string"}}
  }
}
```

Cut verification themes along "end-to-end chains," not "layers."
Cutting by layer means each reviewer only looks at their own layer and misses the most common defect: breaks
at the boundary.

Example themes (the standard three-way split is creation / cancellation / cross-cutting):
1. Creation flow: input → payment/confirmation → save → through to where the asynchronous post-processing
   actually runs to completion
2. Cancellation flow: cancel → compensating action (refund / rollback) → through to where the failure retry
   lands in a dead end
3. Settings changes / scheduled processing + ID hygiene across all files
