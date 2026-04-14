# AGENTS.md

## Project overview
This repository contains a hotel CRM used primarily on phones and tablets.
The main goal is fast, reliable, mobile-first work for managers.

## Core stack
- Next.js
- TypeScript
- Supabase
- Vercel

## Main working principles
- Mobile-first UI is required by default.
- Preserve existing business logic unless the task explicitly requests a logic change.
- Prefer minimal, local, reversible edits.
- Do not perform broad refactors without a clear reason.
- Keep the code understandable for future Codex tasks.

## Critical business flows that must not break
1. Home screen navigation
2. New guest / search and booking flow
3. Room availability flow
4. Booking edit flow
5. Guest data handling
6. Payment handling
7. Room / guest / booking relations with Supabase
8. Existing navigation buttons, especially back/home patterns already used in the UI

## UI rules
- Default to mobile-first layout.
- Optimize for phone and tablet use first, desktop second.
- Keep forms compact and readable on narrow screens.
- Avoid oversized cards and oversized spacing on mobile.
- Prefer clear buttons and predictable navigation.
- Do not remove important navigation actions without replacing them properly.
- Preserve existing UX patterns where possible.

## Data and backend rules
- Do not break existing Supabase schema usage.
- Do not rename database fields unless explicitly required.
- Do not rename environment variables unless necessary.
- Do not change API contracts unless the task explicitly requires it.
- Do not silently change booking, payment, room, or guest logic.
- Any schema-related change must be documented clearly in the final summary.

## Coding rules
- Keep changes targeted.
- Reuse existing helpers, components, and patterns when possible.
- Avoid duplicate logic.
- Do not introduce unnecessary dependencies.
- Keep naming clear and practical.
- Prefer safe fixes over clever rewrites.

## File change behavior
- Only edit files directly related to the task.
- Do not touch unrelated files.
- When a change affects multiple files, keep the scope as small as possible.
- Preserve route names unless explicitly asked to change them.

## Before finishing a task
Always do the following when available:
1. Install dependencies if needed
2. Run build checks
3. Run lint checks if configured
4. Verify that changed pages/components still match mobile-first expectations

Preferred commands:
- npm install
- npm run build
- npm run lint

If a command does not exist, state that clearly in the final summary.

## Final response requirements
At the end of every task, provide:
1. What was changed
2. Why it was changed
3. Which files were changed
4. Whether build/lint/tests were run
5. Any remaining manual steps
6. Any risks or assumptions

## Task style
- Plan briefly before making major changes.
- For ambiguous requests, choose the safest narrow implementation.
- Preserve current behavior unless the task explicitly asks for behavior changes.
- Favor PR-ready results.

## Special instructions for this repository
- The app is frequently tested from a phone.
- Preview deployment friendliness matters.
- Keep layouts easy to validate on mobile screens.
- For booking-related pages, prioritize manager speed and clarity.
- Do not break search by phone, room selection, booking creation, booking editing, or payment flows.
