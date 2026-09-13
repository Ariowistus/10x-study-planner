---
starter_id: 10x-astro-starter
bootstrapper_confidence: first-class
path_taken: standard
has_auth: true
has_ai: false
has_payments: false
has_realtime: false
has_background_jobs: false
---

# Tech Stack — 10x Study Planner

**Verification update, 2026-09-13:** both Node and Cloudflare builds passed
locally on Windows / Node 24.19.0. References below to the `workerd` failure are
the historical reason for retaining two adapters. The declared CI runtime
remains Node 22; no adapter or dependency migration was performed.

- **Input**: `context/foundation/prd.md`
- **Date**: 2026-09-10

## Selection

| Layer                  | Choice                | Version |
| ---------------------- | --------------------- | ------- |
| Meta-framework and API | Astro                 | 6       |
| Interactive UI         | React                 | 19      |
| Type system            | TypeScript            | 5       |
| Styling                | Tailwind CSS          | 4       |
| Database and auth      | Supabase (PostgreSQL) | hosted  |
| Unit tests             | Vitest                | 3       |
| End-to-end tests       | Playwright            | 1       |
| Deployment             | Cloudflare Workers    | via CI  |

The starter `10x-astro-starter` supplies the first five rows already wired
together, including working email-and-password authentication and route
protection. Testing and deployment layers are added by this project.

## Why this stack

**The PRD asks for very little that is exotic.** There is one server-rendered
application, one relational data model with four tables, one pure scheduling
function, and a hard requirement that learners cannot see each other's rows.
Nothing here calls for a specialised runtime, a queue, a realtime channel or a
model provider.

**Astro** matches the shape of the product. Most screens are static structure
with a small amount of interactivity, which is exactly the islands model. Its
API endpoints cover the mutation surface — topics, availability, plan
generation, session status — without introducing a second backend service.

**React** is used only for the parts that genuinely need client state: the topic
form, the availability editor and the session controls. Everything else stays
server-rendered.

**TypeScript** carries the domain types across the whole project. The scheduler
in particular benefits: its input and output shapes are the contract that the
unit tests assert against.

**Tailwind** keeps structure and style in one file, which suits a project where
the interface is functional rather than expressive.

**Supabase** answers two requirements at once. It provides the PostgreSQL
database for the four tables, and its authentication supplies the access control
that the PRD requires. More importantly, row level security lets the ownership
rule live in the database, so `FR-007` is enforced below the application rather
than inside it.

**Vitest** is chosen for unit tests because the business rule is a pure
function. The scheduler takes topics, availability and a week start, and returns
sessions. That is testable without a database, a browser or a network, so the
tests that protect the most important logic are also the fastest ones.

**Playwright** covers the user-visible flow that the certification requires: a
learner signs in, creates a topic, generates a plan and completes a session.

## Agent-friendliness gates

| Gate                     | Verdict | Note                                                                                                                                 |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Typed                    | pass    | TypeScript across pages, endpoints and domain logic                                                                                  |
| Convention-based         | pass    | Astro's directory conventions plus the starter's layout                                                                              |
| Popular in training data | pass    | React, TypeScript and Tailwind are heavily represented; Astro 6 is newer and is compensated by pinning versions and referencing docs |
| Well-documented          | pass    | current official documentation for every layer                                                                                       |

## Deviation from the recommended path

The course recommends deploying to Cloudflare, and this project keeps that
target. However the Cloudflare adapter starts the `workerd` runtime through
miniflare during both `astro dev` and `astro build`, and on the development
machine used here that runtime aborts with an access violation before the build
begins.

The adapter is therefore selected at build time by the `DEPLOY_TARGET`
environment variable: the Node adapter locally, the Cloudflare adapter in
continuous integration and for production. The application itself uses no
Cloudflare-specific binding, so the two builds differ only in their server
entrypoint. The full decision record, including the risk this carries, is in
`context/foundation/infrastructure.md`.

## Commands

| Purpose                       | Command             |
| ----------------------------- | ------------------- |
| Development server            | `npm run dev`       |
| Production build (Node)       | `npm run build`     |
| Production build (Cloudflare) | `npm run build:cf`  |
| Lint                          | `npm run lint`      |
| Unit tests                    | `npm run test:unit` |
| End-to-end tests              | `npm run test:e2e`  |
