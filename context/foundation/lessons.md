# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Manual verification steps must be runnable as presented

- **Context**: /10x-implement, when presenting the phase-end manual confirmation gate. Even if the plan's bullets are vague, the implement skill is responsible for rewriting them into runnable form before showing them to the user.
- **Problem**: When it's time for manual verification, the checklist is not clear enough. The user wants clear steps for what and how to do it. If UI exists, steps should be written as a user flow (go to X, click B, check C). If it's backend-only, steps should be concrete actions with curl commands filled with test data — not vague bullets like "verify the endpoint works."
- **Rule**: Manual verification steps must be runnable as authored. For API-only phases, write each step as a complete curl invocation (URL, method, headers, body, expected status/payload shape). For UI-bearing phases, write each step as a numbered click-path naming the page, control labels, and observable outcome. If a phase builds UI but does not mount it on a reachable route, mark that phase's UI-facing manual items as "deferred to phase N" (the integration phase) and replace them with API-level checks where possible — do not author manual UI steps the user cannot actually reach yet.
- **Applies to**: plan, implement
