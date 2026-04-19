# Teammate Protocol Reference

Single canonical reference for shared teammate protocol. Agent files point here to avoid duplicating these definitions across multiple files.

## SendMessage Call Signature

SendMessage accepts ONLY three fields: `to`, `summary`, `message`.

Canonical call:
  SendMessage({ to: "<teammate-name>", summary: "<5-10 word preview>", message: "<body>" })

- Passing extra fields (`type`, `recipient`, `content`, etc.) does NOT fail — the runtime silently drops them — but it DOES trigger spurious self-routed `task_assignment` envelopes that can wake up other teammates prematurely.
- Plain-text output (text outside of a tool call) is NOT visible to other teammates. You MUST use SendMessage to communicate.

## Activation-signal glossary

- **Activation nudge (instruction-free):** An instruction-free `SendMessage` ping sent by the lead (or in fix cycles, by a peer teammate) to wake a teammate whose turn has arrived. The nudge carries no instructions — always re-read your lead-authored task entry before acting. Sending extra fields (`type`, `recipient`, `content`, etc.) does NOT fail but triggers spurious `task_assignment` envelopes; send ONLY `to`, `summary`, `message`.
- **task_assignment DM:** A runtime-generated DM automatically sent when a task's `owner` field is updated. Informational only — do NOT start work on receipt; wait for the explicit activation nudge from the lead.

## Reviewer activation gate

Begin review only when BOTH are true:
1. The paired creation/implementation task-list entry has status `completed`.
2. You have received an instruction-free SendMessage nudge from the paired writer/developer.

**Exception (lead-spawned standalone reviewer):** When your task-list entry's title or body explicitly describes a cross-sibling or cross-task coherence pass (contains "cross-sibling" or "cross-task coherence") AND the activation nudge comes from `team-lead`, begin from the lead nudge alone — no paired-task completion check required.

## task_assignment DM policy

`task_assignment` DMs have shape `{"type":"task_assignment","taskId":"N",...}` and are informational only — a read receipt that confirms an owner assignment registered with the runtime. They are NOT an activation signal.

Rules for every teammate:

- When a `task_assignment` DM arrives, confirm the referenced task exists via `TaskGet(taskId)`, but do NOT begin work.
- The authoritative start signal is always the explicit instruction-free `SendMessage` activation nudge from the lead (or in fix cycles, from the paired teammate).
- For reviewer teammates specifically, a `task_assignment` DM does NOT satisfy condition 2 of the reviewer activation gate above.
- If a `task_assignment` DM's `assignedBy` field matches your own agent ID (self-bootstrap envelope), ignore it silently and go idle. Do NOT call `TaskList` or begin work.
