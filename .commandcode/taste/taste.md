# Taste

## Workflow
- Prefers a plan-first process: review the existing code and summarize a plan before changing anything, then work in ordered steps with instructions on how to test each step. Confidence: 0.8
- Expects the work to stay strictly inside the requested scope (e.g. packaging/CI-only work must not alter app features) and wants any build errors reported together with how they were fixed. Confidence: 0.65

## Dependencies & tooling
- Strongly averse to new libraries: don't add a dependency without explaining why. Confidence: 0.85

## Code style
- Wants components kept small and typed; reuse the project's existing theme tokens and Tailwind setup rather than introducing parallel styling solutions. Confidence: 0.85
