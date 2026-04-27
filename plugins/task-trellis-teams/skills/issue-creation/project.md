# Create Project

Create a new project in the Trellis task management system from a provided specification.

## Goal

Transform project specifications into a comprehensive project definition with full context and requirements that enable other agents to effectively create epics, features, and ultimately implementable tasks.

## Process

### 1. Parse Input Specifications

#### Specification Input

`$ARGUMENTS`

#### Instructions

Read and analyze the specifications:

- Extract key project goals, requirements, and constraints

### 2. Generate Project Title and Description

Based on the provided specification:

- **Title**: Create a clear, concise project title (5-7 words)
- **Description**: Write comprehensive project specification including:
  - Executive summary
  - Detailed functional requirements
  - Technical requirements and constraints
  - Architecture overview
  - User stories or personas
  - Non-functional requirements (performance, security, etc.)
  - Integration requirements
  - Deployment strategy
  - **Acceptance Criteria**: Specific, measurable requirements as applicable to the project type (e.g., functional behavior, performance benchmarks, security requirements, compatibility needs)
  - Any other context needed for epic creation

### 3. Create Project Using MCP

Create the project using `create_issue` with type `"project"`, the generated title and description. If source materials were inventoried in SKILL.md step 2, include an `## Attachments` section at the end of the description listing each filename with a one-line description:

```markdown
## Attachments

- `<filename>` — <one-line description of what it is and why it matters>
```

Set status to `"open"` or `"draft"` based on user preference.

### 3a. Attach Source Materials

The project is always the **holder** — there is no parent to attach to.

If source materials were inventoried in SKILL.md step 2, call `add_attachment` for each file after the project is created:

```
mcp__plugin_task-trellis-teams_task-trellis__add_attachment({ id: "<project-id>", sourcePath: "/absolute/path/to/file" })
```

If the project body was created without the `## Attachments` section, update it now using `update_issue`.

If no source materials exist in the current conversation, skip this step.

### 4. Output Format

After successful creation:

```
Project created successfully!

Project: [Generated Title]
ID: [generated-id]
Status: [actual-status]

Project Summary:
[First paragraph of description]
```

### 5. STOP - Do Not Continue

**After creating, STOP.** Do not automatically create epics — that requires a separate user request.
