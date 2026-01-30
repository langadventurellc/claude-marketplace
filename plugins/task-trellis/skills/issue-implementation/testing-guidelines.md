# Testing Guidelines

**General Philosophy**: Tests should be purposeful and minimal. Every test must justify its existence. Prefer fewer, well-designed tests over exhaustive coverage.

## Unit Tests

- Write unit tests **only** for logic that has meaningful complexity or risk of regression
- Do NOT test trivial code (simple getters/setters, pass-through methods, basic logging, straightforward CRUD operations)
- A single well-crafted test that covers the important behavior is better than ten tests covering every permutation
- Ask: "What bug would this test actually catch?" If the answer is unclear, skip the test

## Integration Tests

Only write integration tests when **ALL** of these apply:

1. The interaction between components has non-trivial logic or failure modes
2. A bug in this integration would be difficult to catch with unit tests alone
3. The integration is critical to core functionality

Do NOT write integration tests simply because two components communicate.

Integration tests must execute in under 500ms. If they can't, reconsider whether the test is necessary or if it can be restructured.

## Performance Tests

**Never** write performance tests unless explicitly requested by the user. This is not a default part of any feature implementation.

## When in Doubt

Err on the side of fewer tests. Undertesting is easier to fix than maintaining a bloated test suite.
