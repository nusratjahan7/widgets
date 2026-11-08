# Taste
- Prefers a plan-first process: review the existing code and summarize a plan before changing anything, then work in ordered steps with instructions on how to test each step. Confidence: 0.85
- Wants the end result usable by end users without developer tooling (no `npm run dev`): installable/packaged artifacts and normal app launching are the expected delivery. Confidence: 0.7
- Expects the work to stay strictly inside the requested scope (e.g. packaging/CI-only work must not alter app features) and wants any build errors reported together with how they were fixed. Confidence: 0.65
- Strongly averse to new libraries: don't add a dependency without explaining why. Confidence: 0.85
- Wants to be consulted before significant design decisions rather than having them made unilaterally. Confidence: 0.7
- Wants components kept small and typed; reuse the project's existing theme tokens and Tailwind setup rather than introducing parallel styling solutions. Confidence: 0.85
- For opt-in settings that have side effects, default them to off and clearly warn the user about those side effects in the UI. Confidence: 0.6
- Prefers modifying existing widgets/components in place (same registration ID) instead of creating parallel replacements, and expects saved user state (position, enabled state, config values) to keep working with defaults filled in for any new schema fields. Confidence: 0.6
