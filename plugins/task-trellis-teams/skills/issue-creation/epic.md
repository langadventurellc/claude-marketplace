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

### 2. Research the Codebase

**CRITICAL**: Before creating epics, you MUST research the current codebase state. Parent issues may have been written before other work was completed.

1. **Search the codebase** using Glob and Grep to understand:
   - What already exists that's relevant to this project
   - Existing patterns, conventions, and architecture
   - What may have already been partially implemented
   - Current file structure and dependencies
2. **Compare project description against reality** - the project may reference work that's already done or assume a state that no longer exists
3. **Identify actual gaps** - only create epics for work that genuinely needs to be done

Do not blindly create epics based on a project description. The codebase is the source of truth.

### 3. Analyze Project Specification

**After researching the codebase**, analyze the project description to identify remaining epics:

- **Use context7 MCP tool** to research architectural patterns and best practices
- Extract functional requirements from the project description that don't already exist
- Identify major technical components and systems that need to be built
- Consider cross-cutting concerns (security, testing, deployment, monitoring)
- Group related functionality into cohesive work streams
- Identify dependencies between work streams
- Consider development phases and prerequisites
- Note any specific instructions provided in `input`

### 4. Gather Additional Information (Only When Necessary)

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

### 5. Generate Epic Structure

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

### 6. Create Epics Using MCP

For each epic, use `create_issue` with type `"epic"`, the generated title and description, and set `parent` to the project ID. Include `prerequisites` for any epic dependencies. Set status to `"open"` or `"draft"` based on user preference.

**For standalone epics**: Omit the `parent` parameter.

### 7. Output Format

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

### 8. STOP - Do Not Continue

**After creating the epics, STOP.** Do not automatically create features or tasks.

- Report the created epics to the user
- Wait for the user to explicitly request the next level of decomposition
- Do not suggest or offer to create features unless asked

Creating child issues (features) requires a separate user request.

## Simplicity Principles

When creating epics, follow these guidelines:

### Keep It Simple:

- **No over-engineering** - Create only the epics needed for the project
- **No extra features** - Don't add functionality that wasn't requested
- **Choose straightforward approaches** - Simple epic structure over complex hierarchies
- **Solve the actual problem** - Don't anticipate future requirements

### Forbidden Patterns:

- **NO premature optimization** - Don't optimize epic structure unless requested
- **NO feature creep** - Stick to the specified project requirements
- **NO complex dependencies** - Keep epic relationships simple and clear

### Forbidden Patterns:

- **NO premature optimization** - Don't optimize epic structure unless requested
- **NO feature creep** - Stick to the specified project requirements
- **NO complex dependencies** - Keep epic relationships simple and clear
- **NO unnecessary technical debt** - Choose maintainable approaches
- **NO integration or performance tests** - Do not add integration or performance tests unless specifically requested in the input

### Modular Architecture:

- **Clear boundaries** - Each epic should have distinct, well-defined responsibilities
- **Minimal coupling** - Epics should interact through clean interfaces, not internal dependencies
- **High cohesion** - Related functionality should be grouped within the same epic
- **Avoid big ball of mud** - Prevent tangled cross-dependencies between epics
- **Clean interfaces** - Define clear contracts between epics for data and functionality exchange
