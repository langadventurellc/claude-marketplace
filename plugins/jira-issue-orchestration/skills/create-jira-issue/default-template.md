#### Summary

Format: a single one-line outcome statement. No prefix, no component tag.

Rules:

- State the **outcome**, not the implementation. "Report failed status for stalled finalizer jobs" beats "Update enum and add stall detector."
- Strong verb start: Add, Fix, Enable, Remove, Migrate, Expose, Prevent, Report, Restore.
- Under ~80 characters.
- No trailing period.

#### Description

Use this template verbatim. The summary paragraph is **unheaded** — it sits at the very top of the description before any `##` heading. Every section appears — write `N/A` for sections the input doesn't cover.

```
<1–2 sentence plain-English overview of the problem or task. No header. Outcome-focused, minimal jargon.>

## Acceptance Criteria

<What must be true for this issue to be considered done. Bulleted list preferred, one criterion per bullet. Written so a reviewer can check each item against the resulting work.>

## Technical/Other Notes

<Technical or other details that help in achieving the goal: error messages, stack traces, file paths, links to related tickets/PRs, environment specifics, constraints, gotchas, references. Code/log content goes in fenced blocks. Write `N/A` if there's nothing real to add.>
```

#### Humanize the prose sections

After drafting, pass these sections — and only these — through `planning:humanize-text` via the `Skill` tool, one invocation per section, with a context hint identifying the surface:

- The unheaded summary paragraph at the top — hint: `"Jira issue description, summary paragraph"`.
- The body of `## Acceptance Criteria` — hint: `"Jira issue description, acceptance-criteria section"`.

Use each returned rewrite verbatim.

**Do not humanize `## Technical/Other Notes`.** That section is intentionally precise — error messages, stack traces, file paths, identifiers, ticket keys. Humanizing strips the specificity a triager or implementer needs.
