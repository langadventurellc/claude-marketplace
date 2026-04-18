# Create Features

Break down an epic into specific features using the Trellis task management system by analyzing the epic specification and gathering additional requirements as needed. Do not attempt to create multiple features in parallel. Do them sequentially one at a time.

## Goal

Analyze an epic's comprehensive specification to create well-structured features that represent implementable functionality, ensuring complete coverage of the epic's scope and enabling effective task decomposition.

**IMPORTANT**: Features must include actual changes, implementations, or deliverables. Do not create features that are purely research tasks or analysis tasks without any tangible output. Since all features and tasks are executed independently without context from other features or tasks, purely analytical work provides no value.

## Process

### 1. Identify Context and Requirements

#### Input

`$ARGUMENTS`

#### Context Determination

The input may contain:

- **Epic ID**: (e.g., "E-user-auth") - Create features within an epic hierarchy
- **Feature Requirements**: Direct description of standalone functionality needed
- **Mixed**: Epic ID plus additional feature specifications

#### Instructions

**For Hierarchical Features:**

- Retrieve the epic using MCP `get_issue` to access its comprehensive description, requirements, and parent project context

**For Standalone Features:**

- Analyze the provided requirements directly
- No parent context needed, focus on the specific functionality described

### 2. Research the Codebase

**CRITICAL**: Before creating features, you MUST research the current codebase state. Parent issues may have been written before other work was completed.

1. **Search the codebase** using Glob and Grep to understand:
   - What already exists that's relevant to this epic
   - Existing patterns, conventions, and architecture
   - What may have already been partially implemented
   - Current file structure and dependencies
2. **Compare parent issue against reality** - the epic description may reference work that's already done or assume a state that no longer exists
3. **Identify actual gaps** - only create features for work that genuinely needs to be done

Do not blindly create features based on an epic description. The codebase is the source of truth.

### 3. Analyze Requirements

**After researching the codebase**, analyze requirements to identify remaining features:

- Extract deliverables and components from the epic description that don't already exist
- Review architecture and adjust based on current codebase state
- Analyze user stories to identify discrete user-facing functionality
- Consider non-functional requirements that need specific implementation
- Group related functionality into cohesive features
- Identify dependencies between features
- Note any specific instructions provided in `input`

### 4. Gather Additional Information (Only When Necessary)

**Proceed autonomously unless information is truly ambiguous.** Do not ask about:
- Feature granularity (default to coarser-grained features)
- How many features to create (use your judgment)
- Whether to proceed with feature creation (just create the features and stop)

**Only ask clarifying questions when:**
- Requirements are genuinely ambiguous with multiple valid interpretations
- Critical technical information is missing that cannot be inferred
- A decision has significant irreversible consequences

Continue until the feature structure:

- Covers all aspects of the epic specification that aren't already implemented
- Has clear implementation boundaries
- Enables independent development and testing

### 5. Generate Feature Structure

For each feature, create:

- **Title**: Clear, specific name (3-5 words)
- **Description**: Comprehensive explanation including:
  - Purpose and functionality
  - Key components to implement
  - **Acceptance Criteria**: Specific, measurable requirements as applicable to the feature type (functional behavior, UI requirements, validation criteria, integration points, performance/security needs)
  - Technical requirements
  - Dependencies on other features
  - **Implementation Guidance** - Technical approach and patterns to follow
  - **Testing Requirements** - What meaningful tests are needed
  - **Security Considerations** - Input validation, authorization, data protection needs as applicable
  - **Performance Requirements** - Response times, resource usage constraints as applicable

**Feature Granularity Guidelines:**

**Default to COARSER-grained features** that are easier for AI agents to orchestrate:

- **Fewer, larger features** - Prefer 2-4 substantial features over 8+ small ones
- **Meaningful scope** - Each feature should represent a coherent area of functionality
- **Independent implementation** - Features should be implementable without blocking other features
- **Clear boundaries** - Each feature should have distinct responsibilities
- **Testable outcomes** - Features should have clear success criteria

**Why coarser features:**
- Easier for AI agents to understand context and implement correctly
- Reduces overhead of managing many small features
- Fewer dependencies between features
- More cohesive implementation per feature

### 6. Create Features Using MCP

For each feature, use `create_issue` with type `"feature"`, the generated title and description, and set `parent` to the epic ID if applicable. Include `prerequisites` for any feature dependencies. Set status to `"open"` or `"draft"` based on user preference.

**For standalone features**: Omit the `parent` parameter.

### 7. Output Format

After successful creation:

```
Successfully created [N] features for epic "[Epic Title]"

Created Features:
1. F-[id1]: [Feature 1 Title]
   -> Dependencies: none

2. F-[id2]: [Feature 2 Title]
   -> Dependencies: F-[id1]

3. F-[id3]: [Feature 3 Title]
   -> Dependencies: F-[id1], F-[id2]

Feature Summary:
- Total Features: [N]
```

### 8. STOP - Do Not Continue

**After creating the features, STOP.** Do not automatically create tasks.

- Report the created features to the user
- Wait for the user to explicitly request the next level of decomposition
- Do not suggest or offer to create tasks unless asked

Creating child issues (tasks) requires a separate user request.

## Simplicity Principles

When creating features, follow these guidelines:

### Keep It Simple:

- **No over-engineering** - Create only the features needed for the epic
- **No extra features** - Don't add functionality that wasn't requested
- **Choose straightforward approaches** - Simple feature structure over complex designs
- **Solve the actual problem** - Don't anticipate future requirements

### Forbidden Patterns:

- **NO premature optimization** - Don't optimize feature structure unless requested
- **NO feature creep** - Stick to the specified epic requirements
- **NO complex dependencies** - Keep feature relationships simple and clear
- **NO unnecessary abstractions** - Choose direct, maintainable approaches
- **NO pure research/analysis features** - Every feature must produce actual code, configuration, or tangible deliverables
- **NO integration or performance tests** - Do not add integration or performance tests unless specifically requested in the input

### Modular Architecture:

- **Clear boundaries** - Each feature should have distinct, well-defined responsibilities
- **Minimal coupling** - Features should interact through clean interfaces, not internal dependencies
- **High cohesion** - Related functionality should be grouped within the same feature
- **Avoid big ball of mud** - Prevent tangled cross-dependencies between features
- **Clean interfaces** - Define clear contracts between features for data and functionality exchange
