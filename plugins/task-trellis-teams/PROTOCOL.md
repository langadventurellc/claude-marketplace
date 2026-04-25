# Teammate Protocol Reference

Single canonical reference for shared teammate protocol. Agent files point here to avoid duplicating these definitions across multiple files.

## SendMessage Call Signature

SendMessage accepts ONLY three fields: `to`, `summary`, `message`.

Canonical call:
  SendMessage({ to: "<teammate-name>", summary: "<5-10 word preview>", message: "<body>" })

- Extra fields (`type`, `recipient`, `content`, etc.) are silently dropped but may produce spurious `task_assignment` envelopes. Send only `to`, `summary`, `message`.
- Plain-text output (text outside of a tool call) is NOT visible to other teammates. You MUST use SendMessage to communicate.

## Activation-signal glossary

- **Activation nudge (pointer-only):** The lead — or in post-completion handoffs, the paired developer/writer — sends a `SendMessage` naming a task-list task ID. The teammate self-claims on receipt by calling `TaskUpdate({ taskId, owner: <self>, status: "in_progress" })`.

## Reviewer activation gate

Two cases:
- **Per-issue / paired-handoff reviewers** (implementation, issue-creation, reconciliation): activate on receipt of a pointer-only `SendMessage` from the paired developer or writer naming the review task-list task ID.
- **Standalone reviewers** (cross-sibling, coherence): activate on receipt of a pointer-only `SendMessage` from the lead naming the review task-list task ID.

