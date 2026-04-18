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

Create the project using `create_issue` with type `"project"`, the generated title and description. Set status to `"open"` or `"draft"` based on user preference.

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

**After creating the project, STOP.** Do not automatically create epics, features, or tasks.

- Report the created project to the user
- Wait for the user to explicitly request the next level of decomposition
- Do not suggest or offer to create epics unless asked

Creating child issues (epics) requires a separate user request.

## Simplicity Principles

When creating projects, follow these guidelines:

### Keep It Simple:

- **No over-engineering** - Create only the specifications needed for the project
- **No extra features** - Don't add functionality that wasn't requested
- **Choose straightforward approaches** - Simple project structure over complex architectures
- **Solve the actual problem** - Don't anticipate future requirements

### Forbidden Patterns:

- **NO premature optimization** - Don't optimize project structure unless requested
- **NO feature creep** - Stick to the specified project requirements
- **NO complex architectures** - Choose simple, maintainable approaches
- **NO unnecessary abstractions** - Use direct solutions that work
- **NO integration or performance tests** - Do not add integration or performance tests unless specifically requested in the input

### Modular Architecture:

- **Clear boundaries** - Project should define distinct modules with well-defined responsibilities
- **Minimal coupling** - Modules should interact through clean interfaces, not internal dependencies
- **High cohesion** - Related functionality should be grouped within the same module
- **Avoid big ball of mud** - Prevent tangled cross-dependencies between system components
- **Clean interfaces** - Define clear contracts between modules for data and functionality exchange
