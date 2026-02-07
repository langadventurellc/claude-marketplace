# Code Documentation Guidelines

**General Philosophy**: Documentation is for AI agents. Write concisely with the understanding that future developers—likely AI—have already read the code. Don't duplicate what's visible in the implementation.

## What to Document

Document **only** public interfaces:

- Public functions and methods
- Public classes and their constructors
- Exported types and interfaces
- Module-level exports

**Do NOT document**:

- Private or internal functions
- Helper utilities used only within a module
- Obvious getters/setters
- Implementation details visible in the code

## How to Document

### Be Concise

One sentence is often enough. The reader has already read the code.

**Good:**
```typescript
/** Validates user credentials and returns a session token. */
async function authenticate(email: string, password: string): Promise<string>
```

**Bad:**
```typescript
/**
 * Validates user credentials and returns a session token.
 *
 * This function takes an email and password, validates them against
 * the database, and if successful, generates a JWT token that can
 * be used for subsequent authenticated requests.
 *
 * @param email - The user's email address used for identification
 * @param password - The user's password in plain text
 * @returns A Promise that resolves to a JWT session token string
 * @throws AuthenticationError if credentials are invalid
 * @throws DatabaseError if the database connection fails
 */
async function authenticate(email: string, password: string): Promise<string>
```

### Skip the Obvious

Don't document:

- **Parameter types** - They're in the signature
- **Return types** - They're in the signature
- **Every possible error** - The code shows what can throw
- **Implementation details** - Read the function body

### Focus on the "Why" and "What"

Document things that aren't obvious from reading the code:

- **Business logic intent** - Why does this rule exist?
- **Non-obvious constraints** - Rate limits, required ordering, side effects
- **Usage context** - When should this be called vs. alternatives?

**Good:**
```typescript
/** Must be called before any database operations. Initializes connection pool. */
function initDatabase(): void
```

**Bad:**
```typescript
/** Initializes the database. */
function initDatabase(): void
```

### Examples Over Explanations

When behavior is complex, a brief example communicates faster than prose:

```typescript
/**
 * Formats bytes as human-readable string.
 * Example: formatBytes(1536) → "1.5 KB"
 */
function formatBytes(bytes: number): string
```

## What NOT to Do

- **Don't add docs to every function** - Only public interfaces
- **Don't list all parameters** - Types are self-documenting
- **Don't enumerate all errors** - Code reveals error conditions
- **Don't explain the implementation** - The code is right there
- **Don't add TODO comments for future AI** - Create tasks instead
- **Don't write documentation for internal/private code**

## Remember

An AI agent reading your documentation has likely already read:

1. The function signature (types, parameters, return type)
2. The function body (implementation, error handling)
3. The surrounding context (imports, callers, tests)

Write documentation that adds value beyond what's already visible. If the documentation just restates what the code shows, delete it.
