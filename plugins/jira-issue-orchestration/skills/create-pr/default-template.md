## What

<Plain English prose describing what this PR accomplishes. Written to sound like a human dev wrote it — outcome-focused, minimal jargon, no implementation play-by-play. Length follows the change: a small PR gets a sentence; a bigger one gets a short paragraph. See the humanize step below — this text is passed through `planning:humanize-text` before emit.>

## Why

<The branch-level value this change delivers — what capability it adds, what class of problems it prevents, what contract it establishes. Answers "why do we want this whole branch?", not "why each implementation decision." Reference the triggering incident/ticket only as context, not as the answer. Also passed through `planning:humanize-text`.>

## Jira ticket

[<PRIMARY-KEY>](<BASE_URL>/browse/<PRIMARY-KEY>)
<additional detected keys on subsequent lines, same link format, one per line — omit entirely if none>

## Steps to Validate/Verify

<what the reviewer does locally to verify. Bullet list preferred. URLs, commands, seeds, env vars. If genuinely nothing beyond normal CI / code review, write "N/A — covered by automated tests and code review.">

## Additional Notes

<forward-looking info a reviewer/maintainer needs that isn't obvious from the diff — flags, deploy ordering, follow-ups, non-obvious runtime impacts. Write "N/A" if none.>
