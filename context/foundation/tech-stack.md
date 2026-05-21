---
starter_id: 10x-astro-starter
package_manager: npm
project_name: assessly
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

A solo developer shipping a book-recommendation MVP in 3 weeks of after-hours work with auth and an AI recommendation feature needs a battle-tested, agent-friendly starter that handles auth + database + deploy out of the box. 10x Astro Starter (Astro + Supabase + Cloudflare) is the recommended default for (web-app, js) and clears all four agent-friendly gates — typed (TypeScript + Zod), convention-based, popular in training data, and well-documented. Auth is handled by Supabase's built-in auth module; AI recommendation calls route through Astro API endpoints. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages.
