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

### 2. Analyze Requirements

**Thoroughly analyze the requirements (feature description OR standalone requirements) to identify required tasks:**

- **Search codebase** for similar task patterns or implementations
- Extract all components and deliverables from the feature description
- Review implementation guidance and technical approach
- Identify testing requirements for comprehensive coverage
- Consider security considerations that need implementation
- Analyze performance requirements and constraints
- Group related implementation work
- Identify task dependencies and sequencing
- Note any specific instructions provided in `input`

### 3. Gather Additional Information

**Ask clarifying questions as needed to refine the task breakdown:**

Use this structured approach:

- **Ask one question at a time** with specific options
- **Focus on task boundaries** - understand what constitutes a complete, testable task
- **Identify implementation details** - specific technical approaches or patterns
- **Continue until complete** - don't stop until you have clear task structure

Key areas to clarify:

- **Implementation Details**: Specific technical approaches or patterns?
- **Task Boundaries**: What constitutes a complete, testable task?
- **Dependencies**: Which tasks must complete before others?
- **Testing Approach**: See [Testing Guidelines](testing-guidelines.md)
- **Security Implementation**: How to handle validation and authorization?

**When in doubt, ask.** Use the AskUserQuestion tool to clarify requirements. Agents tend to be overconfident about what they can infer - a human developer would ask more questions, not fewer. If you're making assumptions, stop and ask instead.

Continue until the task structure:

- Covers all aspects of the feature specification
- Represents atomic units of work (1-2 hours each)
- Has clear implementation boundaries
- Addresses security considerations appropriately

### 4. Generate Task Structure

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

Each task should be sized appropriately for implementation:

- **1-2 hours per task** - Tasks should be completable in one sitting
- **Atomic units of work** - Each task should produce a meaningful, testable change
- **Independent implementation** - Tasks should be workable without blocking others
- **Specific scope** - Implementation approach should be clear from the task description
- **Testable outcome** - Tasks should have defined acceptance criteria

**Default task hierarchy approach:**

- **Prefer flat structure** - Most tasks should be at the same level
- **Only create sub-tasks when necessary** - When a task is genuinely too large (>2 hours)
- **Keep it simple** - Avoid unnecessary complexity in task organization

Group tasks logically:

- **Setup/Configuration**: Initial setup tasks
- **Core Implementation**: Main functionality (includes unit tests and documentation)
- **Security**: Validation and protection (includes related tests and docs)

### 5. Create Tasks Using MCP

For each task, use `create_issue` with type `"task"`, the generated title and description, and set `parent` to the feature ID if applicable. Include `prerequisites` for task dependencies. Set `priority` based on criticality (high for blockers/security-critical, medium for standard work, low for enhancements). Set status to `"open"` or `"draft"` based on user preference.

**For standalone tasks**: Omit the `parent` parameter.

### 6. Output Format

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
