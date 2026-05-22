# Verifying a changed skill or agent (headless)

When the change under test is itself a Claude Code skill, agent, or plugin surface, the production-like way to exercise it is to drive a headless Claude Code instance against it and observe whether the skill fires and does its job.

## Recipe

Run from the repo root, pointing at the plugin that contains the changed skill:

```bash
claude -p "<prompt that describes the task the skill should handle>" \
  --plugin-dir <path-to-plugin> \
  --bare \
  --output-format json
```

- **`--plugin-dir`** loads the skill under test deliberately. **`--bare`** disables auto-discovery of the tester's own config, so you are verifying *this* skill in isolation rather than whatever else is installed.
- **Prompt the behavior, not the slash command.** User-invoked skills are not callable as `/name` in `-p` mode. Describe the situation that should make the skill fire (e.g. "QA the completed feature F-123") and check that the skill engages.
- **Read the verdict** from `.result` in the JSON output. For a machine-checkable pass/fail, add `--json-schema '{...}'` and read `.structured_output`. A non-zero exit code is a hard failure.

## Prove the skill actually loaded

A headless run that silently failed to load the skill verifies nothing. Confirm it loaded before trusting the result:

```bash
claude -p "<prompt>" --plugin-dir <path> --bare \
  --output-format stream-json --verbose
```

The `system/init` event lists loaded `plugins` and a `plugin_errors[]` array. **Fail the verification if the skill under test is absent from `plugins` or appears in `plugin_errors`** — the run never exercised the change.

## Pre-approve the tools the skill needs

The headless run will block on permission prompts otherwise. Pass `--allowedTools "Bash,Read,..."` listing the tools the skill invokes, or `--permission-mode dontAsk` for a fully non-interactive run.
