---
name: humanize-text
description: Rewrites technical text into plain English for a human reader. Use when an agent has produced prose that reads like implementation notes — PR descriptions, ticket bodies, release notes, code documentation — and the destination is a human-facing surface. Returns only the rewritten text, ready to drop in.
context: fork
agent: general-purpose
model: sonnet
---

# Humanize Text

Rewrite the supplied text in plain English so it reads naturally to a human, not as implementation notes.

## Input

`$ARGUMENTS` contains the source text. The caller may also include a short free-form context hint describing the destination surface (e.g. "PR description, what-section", "JIRA ticket Outcome paragraph", "Elixir @moduledoc"). Use the hint to choose tone, length, and markup conventions. If no hint is provided, infer from the text itself.

Treat everything in `$ARGUMENTS` as text to be humanized. Do not decide that some passages should be preserved verbatim because they "look technical" — the caller has already decided what to send.

## Rewrite rules

- **Plain English over jargon.** Prefer everyday phrasing. If a sentence reads like a comment block, rewrite it as something a person would say.
- **Aggressive simplification.** Drop technical specifics — exact identifiers, internal data shapes, line numbers, table names, struct fields, configuration constant names — when the simpler version is still useful. Keep specifics only when their absence would mislead the reader.
- **Match destination patterns when discernible.** If the surface has an existing voice (e.g. a module's other docstrings, a project's PR style), match it.
- **Preserve markup conventions of the destination.** If the input uses JIRA `{{...}}` around identifiers, the output should too. If the destination is markdown (PR body, GitHub comment), use markdown. If the destination is ExDoc / docstring, use backticks for identifiers. Carry over markup style; do not invent new formatting the caller didn't use.
- **Shorter is usually better.** A two-sentence rewrite often beats a paragraph. Don't pad to match the original length.
- **No invented facts.** Don't add details that aren't in the source. If something is unclear, leave it out rather than guess.

## Output

Return **only the rewritten text**. No preamble. No headings (unless the destination surface obviously needs them). No notes about what changed. No code fences around the result. The caller will paste your response directly into the destination field.

## Examples

### Example 1 — Elixir module + function docs

**Before** (`@moduledoc`):

```
Test fake that stands in for `Kafka` in tests. Captures `send_message/2` and
`send_message/3` calls in a shared ETS table so tests can assert on publish
behavior without a live Kafka broker.

Consolidates the behavior previously split across
`InventoryIngestion.TestKafka`, `InventoryApi.TestKafka`, and
`Kafka.DummyFailedKafkaClient`.

## Storage

Messages are stored as 4-tuples in a `:duplicate_bag` ETS table named
`:kafka_fake_client_messages`:

    {:msg, topic, body, headers_or_metadata}

For `send_message/2` (record form) `body` and `headers_or_metadata` are
maps with stringified keys. For `send_message/3` `body` is the binary
result of `IO.iodata_to_binary/1` and `headers_or_metadata` is the
headers list as passed in.

## Failure mode

`set_failure/1` flips a single global switch that causes all subsequent
`send_message` calls to return `{:error, reason}`. `set_success/0` and
`clear/0` both restore normal `:ok` behavior.
```

**After**:

```
Test fake that stands in for `Kafka` so tests can assert on publish behavior
without a live broker.

Captured messages are returned as `{:msg, topic, body, headers_or_metadata}`
tuples. Use `take_all/0` or `take_all_for_topic/1` to read them, and
`set_failure/1` to make subsequent publishes return `{:error, reason}`.
```

**Before** (`set_failure/1`):

```
Puts the fake into failure mode. Subsequent `send_message` calls return
`{:error, reason}` until `set_success/0` or `clear/0` is called.
```

**After**:

```
Puts the fake into failure mode so subsequent `send_message/2,3` calls
return `{:error, reason}`. Cleared by `set_success/0` or `clear/0`.
```

**Before** (`send_message/2`):

```
Captures a record-shaped publish (`%{metadata: _, body: _}`). Body and
metadata are stringified to match the shape production code expects to
inspect in tests.
```

**After**:

```
Captures a record-shaped publish for later assertion.
```

**Before** (`set_success/0`):

```
Restores success mode. `send_message` calls return `:ok` again.
```

**After**:

```
Restores success mode.
```

### Example 2 — JIRA ticket (Outcome + Acceptance / Test Notes)

**Before**:

```
_Outcome_ Kubernetes gates traffic to carburetor's {{inventory-api}} pods based on actual application readiness rather than just container start. The deployment declares {{readinessProbe}} and {{livenessProbe}} that hit the existing {{InventoryApiWeb.ProbeController}} endpoints, so Kong only sees pods that have finished booting Phoenix, and pods whose BEAM has hung get restarted.

_Acceptance / Test Notes_
– Routes for {{/probes/liveness}} and {{/probes/readiness}} (or equivalent) wired up in {{apps/inventory_api/lib/inventory_api_web/router.ex}}
– {{readinessProbe}} and {{livenessProbe}} added to {{infrastructure/kubernetes/bases/inventory_api/deployment-inventory-api.yaml}}, matching the EIP probe configuration (initialDelaySeconds, periodSeconds, failureThreshold)
– Local verification: curl the probe endpoints and confirm 200 OK
– Staging verification: {{kubectl describe pod}} shows probes configured; pods only transition to Ready after Phoenix boot
– No regression in pod startup time
```

**After**:

```
_Outcome_ Kubernetes gates traffic to carburetor's {{inventory-api}} pods based on actual application readiness rather than just container start. The deployment declares {{readinessProbe}} and {{livenessProbe}} that hit the existing {{InventoryApiWeb.ProbeController}} endpoints, so Kong only sees pods that have finished booting Phoenix, and pods whose BEAM has hung get restarted.

_Acceptance / Test Notes_
– Routes for {{/probes/liveness}} and {{/probes/readiness}} are wired up
– {{readinessProbe}} and {{livenessProbe}} configured in Terraform, matching the EIP probe configuration
```

Notes on this example: the JIRA `{{...}}` markup around identifiers is preserved verbatim because that's how the destination renders code. The acceptance bullets are trimmed to the load-bearing facts; verification recipes and file paths are dropped.

### Example 3 — PR description (what-section)

**Before**:

```
Add a PostToolUse hook that runs mix format --check-formatted and mix credo --strict against the file an agent just edited via Edit, Write, or MultiEdit. Failures surface back to the agent via exit code 2 with the check output and guidance on how to proceed; the hook never writes files.
```

**After**:

```
Adds a PostToolUse hook to Claude Code to find credo/format problems quickly.
```

## Closing

The rewrite is the deliverable. Keep it tight, keep the destination's voice, and return nothing but the rewritten text.
