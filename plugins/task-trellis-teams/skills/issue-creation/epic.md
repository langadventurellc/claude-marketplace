# Create Epics

Break down a project into major epics using the Trellis task management system by analyzing the project specification and gathering additional requirements as needed. Do not attempt to create multiple epics in parallel. Do them sequentially one at a time.

## Goal

Analyze a project's comprehensive specification to create well-structured epics that represent major work streams, ensuring complete coverage of all project requirements and enabling effective feature decomposition.

## Process

### 1. Identify Target Project

#### Input

`$ARGUMENTS`

#### Project Context

The project ID may be:

- Provided in `input` (e.g., "P-inventory-mgmt")
- Known from previous conversation context
- Specified along with additional instructions in `input`

#### Instructions

Retrieve the project using MCP `get_issue` to access its comprehensive description and requirements.

### 2. Analyze Project Specification

Analyze the project description to identify remaining epics:

- Extract functional requirements from the project description that don't already exist
- Identify major technical components and systems that need to be built
- Consider cross-cutting concerns (security, testing, deployment, monitoring)
- Group related functionality into cohesive work streams
- Identify dependencies between work streams
- Consider development phases and prerequisites
- Note any specific instructions provided in `input`

### 3. Gather Additional Information (Only When Necessary)

**Proceed autonomously unless information is truly ambiguous.** Do not ask about:
- Epic granularity (default to coarser-grained epics)
- How many epics to create (use your judgment)
- Whether to proceed with epic creation (just create the epics and stop)

**Only ask clarifying questions when:**
- Requirements are genuinely ambiguous with multiple valid interpretations
- Critical technical information is missing that cannot be inferred
- A decision has significant irreversible consequences

Continue until the epic structure:

- Covers all aspects of the project specification that aren't already implemented
- Has clear boundaries and scope
- Enables parallel development where possible
- Supports logical feature breakdown

### 4. Generate Epic Structure

For each epic, create:

- **Title**: Clear, descriptive name (3-5 words)
- **Description**: Comprehensive explanation including:
  - Purpose and goals
  - Major components and deliverables
  - **Acceptance Criteria**: Specific, measurable requirements as applicable (functional deliverables, integration requirements, quality standards, security/compliance needs)
  - Technical considerations
  - Dependencies on other epics
  - Estimated scale (number of features)
  - **User Stories** - Key user scenarios this epic addresses
  - **Non-functional Requirements** - Performance, security, scalability considerations as applicable

### 5. Create Epics Using MCP

For each epic, use `create_issue` with type `"epic"`, the generated title and description, and set `parent` to the project ID. Include `prerequisites` for any epic dependencies. Set status to `"open"` or `"draft"` based on user preference.

**For standalone epics**: Omit the `parent` parameter.

### 5a. Attach Source Materials

Attach source materials inventoried in SKILL.md step 2 according to the hierarchy:

**Epics under a project (parent exists):** Attach source materials to the **parent project**, not to each epic. Call `add_attachment` with the project ID, then update the project body to include a holder-style `## Attachments` section if not already present. Include a child-style `## Attachments` section in each epic body:

```markdown
## Attachments

See `<filename>` on `<project-id>`. Direct path: `${TRELLIS_DATA_DIR:-~/.trellis}/projects/<projectKey>/p/<project-id>/attachments/<filename>`
```

**Standalone epics (no parent):** The epic itself is the holder. Include a holder-style `## Attachments` section in the epic body (or update via `update_issue` if already created), then call `add_attachment` with the epic ID:

```markdown
## Attachments

- `<filename>` — <one-line description of what it is and why it matters>
```

For how to find `<projectKey>`, see [attachment-paths.md](attachment-paths.md).

If no source materials exist in the current conversation, skip this step.

### 6. Output Format

After successful creation:

```
Successfully created [N] epics for project "[Project Title]"

Created Epics:
1. E-[id1]: [Epic 1 Title]
   -> Dependencies: none

2. E-[id2]: [Epic 2 Title]
   -> Dependencies: E-[id1]

3. E-[id3]: [Epic 3 Title]
   -> Dependencies: E-[id1], E-[id2]

Epic Summary:
- Total Epics: [N]
```

### 7. STOP - Do Not Continue

**After creating, STOP.** Do not automatically create features or tasks — that requires a separate user request.
