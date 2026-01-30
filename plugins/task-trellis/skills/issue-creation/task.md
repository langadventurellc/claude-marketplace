# Create Tasks

Break down a feature into specific, actionable tasks using the Trellis task management system. Do not attempt to create multiple tasks in parallel. Do them sequentially one at a time.

## Goal

Analyze a feature's comprehensive specification to create granular tasks that can be individually claimed and completed by developers, ensuring complete implementation of the feature with proper testing and security considerations.

## Process

### 1. Identify Context and Requirements

#### Input

`$ARGUMENTS`

#### Context Determination

The input may contain:

- **Feature ID**: (e.g., "F-user-registration") - Create tasks within a feature hierarchy
- **Task Requirements**: Direct description of standalone work needed
- **Mixed**: Feature ID plus additional task specifications

#### Instructions

**For Hierarchical Tasks:**

- Retrieve the feature using MCP `get_issue` to access its comprehensive description, requirements, and parent epic/project context

**For Standalone Tasks:**

- Analyze the provided requirements directly
- No parent context needed, focus on the specific work described

### 2. Research the Codebase

**CRITICAL**: Before creating tasks, you MUST research the current codebase state. Parent issues may have been written before other work was completed.

1. **Search the codebase** using Glob and Grep to understand:
   - What already exists that's relevant to this feature
   - Existing patterns, conventions, and architecture
   - What may have already been partially implemented
   - Current file structure and dependencies
2. **Compare parent issue against reality** - the feature description may reference work that's already done or assume a state that no longer exists
3. **Identify actual gaps** - only create tasks for work that genuinely needs to be done

Do not blindly create tasks based on a feature description. The codebase is the source of truth.

### 3. Analyze Requirements

**After researching the codebase**, analyze requirements to identify remaining tasks:

- Extract components and deliverables from the feature description that don't already exist
- Review implementation guidance and adjust based on current codebase state
- Identify testing requirements for comprehensive coverage
- Consider security considerations that need implementation
- Analyze performance requirements and constraints
- Group related implementation work
- Identify task dependencies and sequencing
- Note any specific instructions provided in `input`

### 4. Gather Additional Information (Only When Necessary)

**Proceed autonomously unless information is truly ambiguous.** Do not ask about:
- Task granularity (default to coarser-grained tasks)
- How many tasks to create (use your judgment)
- Whether to proceed with task creation (just do it)

**Only ask clarifying questions when:**
- Requirements are genuinely ambiguous with multiple valid interpretations
- Critical technical information is missing that cannot be inferred
- A decision has significant irreversible consequences

Continue until the task structure:

- Covers all aspects of the feature specification that aren't already implemented
- Has clear implementation boundaries
- Addresses security considerations appropriately

### 5. Generate Task Structure

For each task, create:

- **Title**: Clear, actionable description
- **Description**: Detailed explanation including:
  - **Detailed Context**: Enough information for a developer new to the project to complete the work, including:
    - Links to relevant specifications, documentation, or other Trellis issues (tasks, features, epics, projects)
    - References to existing patterns or similar implementations in the codebase
    - Specific technologies, frameworks, or libraries to use
    - File paths and component locations where work should be done
  - **Specific implementation requirements**: What exactly needs to be built
  - **Technical approach to follow**: Step-by-step guidance on implementation
  - **Detailed Acceptance Criteria**: Specific, measurable requirements that define task completion, including:
    - Functional deliverables with clear success metrics
    - Security requirements and compliance standards
    - User experience criteria and usability standards where applicable
    - Integration requirements with other components
    - Testing expectations and coverage requirements
  - **Dependencies on other tasks**: Prerequisites and sequencing
  - **Security considerations**: Validation, authorization, and protection requirements
  - **Testing requirements**: Specific tests to write and coverage expectations
  - **Out of scope**: Explicitly state what should NOT be done for this task (e.g., work handled by other tasks, future enhancements)

**Task Granularity Guidelines:**

**Default to COARSER-grained tasks** that are easier for AI agents to orchestrate:

- **Fewer, larger tasks** - Prefer 3-5 substantial tasks over 10+ small ones
- **Meaningful scope** - Each task should represent a coherent piece of functionality
- **Independent implementation** - Tasks should be workable without blocking others
- **Clear boundaries** - Implementation approach should be clear from the task description
- **Testable outcome** - Tasks should have defined acceptance criteria

**Why coarser tasks:**
- Easier for AI agents to understand context and implement correctly
- Reduces overhead of switching between many small tasks
- Fewer dependencies to manage
- More cohesive changes per task

**Default task hierarchy approach:**

- **Prefer flat structure** - Most tasks should be at the same level
- **Avoid sub-tasks** - Keep the structure simple
- **Group related work** - Combine related changes into single tasks

Group tasks logically:

- **Setup/Configuration**: Initial setup tasks
- **Core Implementation**: Main functionality (includes unit tests and documentation)
- **Security**: Validation and protection (includes related tests and docs)

### 6. Create Tasks Using MCP

For each task, use `create_issue` with type `"task"`, the generated title and description, and set `parent` to the feature ID if applicable. Include `prerequisites` for task dependencies. Set `priority` based on criticality (high for blockers/security-critical, medium for standard work, low for enhancements). Set status to `"open"` or `"draft"` based on user preference.

**For standalone tasks**: Omit the `parent` parameter.

### 7. Output Format

After successful creation:

```
Successfully created [N] tasks for feature "[Feature Title]"

Created Tasks:
Database & Models:
  T-[id1]: Create user database model with validation
  T-[id2]: Add email verification token system

API Development:
  T-[id3]: Create POST /api/register endpoint with validation
  T-[id4]: Implement email verification endpoint
  T-[id5]: Add rate limiting with monitoring

Frontend:
  T-[id6]: Create registration form component with error handling
  T-[id7]: Add client-side validation
  T-[id8]: Implement success/error states

Task Summary:
- Total Tasks: [N]
- High Priority: [X]
```

Note: Tests are included within tasks only where meaningful complexity exists, per the [Testing Guidelines](testing-guidelines.md). Separate integration test tasks are created only when critical cross-component interactions need verification.

## Task Creation Guidelines

Ensure tasks are:

- **Atomic**: Completable in one sitting (1-2 hours)
- **Specific**: Clear implementation path
- **Testable**: Defined acceptance criteria
- **Independent**: Minimal coupling where possible
- **Secure**: Include necessary validations

Common task patterns:

- **Model/Schema**: Create with validation and indexing
- **API Endpoint**: Implement with input validation and error handling
- **Frontend Component**: Create with interactivity and state handling
- **Security**: Input validation, authorization, rate limiting

## Testing

Before creating any testing-related tasks, read the [Testing Guidelines](testing-guidelines.md).

## Simplicity Principles

When creating tasks, follow these guidelines:

### Keep It Simple:

- **No over-engineering** - Create only the tasks needed for the feature
- **No extra features** - Don't add functionality that wasn't requested
- **Choose straightforward approaches** - Simple task structure over complex designs
- **Solve the actual problem** - Don't anticipate future requirements

### Forbidden Patterns:

- **NO premature optimization** - Don't optimize task structure unless requested
- **NO feature creep** - Stick to the specified feature requirements
- **NO complex dependencies** - Keep task relationships simple and clear
- **NO unnecessary abstractions** - Choose direct, maintainable approaches
- **NO integration or performance tests** - Do not add integration or performance tests unless specifically requested in the input

### Modular Architecture:

- **Clear boundaries** - Each task should have distinct, well-defined responsibilities
- **Minimal coupling** - Tasks should create components that interact through clean interfaces
- **High cohesion** - Related functionality should be grouped within the same task/component
- **Avoid big ball of mud** - Prevent tangled cross-dependencies between components
- **Clean interfaces** - Create clear contracts between components for data and functionality exchange

<rules>
  <important>Always include "Out of scope" in task descriptions to prevent scope creep</important>
</rules>
