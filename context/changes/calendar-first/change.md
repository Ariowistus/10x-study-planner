# Calendar-first study tracker

User decision, 2026-09-13: two navigation destinations, Realizacja first and
Kalendarz second. No separate topic setup, availability setup or plan generation
in the everyday UI. Calendar entries are the checklist items on the dashboard.

Design: retain surface #faf9f7, raised #ffffff, ink #1a1815, muted #6f6a63,
brand #0f6b5c and brand-soft #e8f2ef with the existing dark equivalents.
Geist headings/body and Geist Mono times. Signature: a chronological checklist
with a dedicated time column and large completion controls. Calendar uses a
compact month selector beside a readable day agenda and one entry form, instead
of squeezing editing forms into seven narrow day columns. On phones the month
sits above the day agenda. No new decorative visual system.

Data: retain all existing topics/sessions. Add nullable start_time; old entries
remain explicitly untimed. A security-invoker RPC atomically creates/edits an
entry and its topic/plan, with ownership, duration and overlap validation.
Completed entries require undo before editing/deletion. Progress in Realizacja
uses actual scheduled/completed minutes in the selected week, so repeated names
do not reach 100% after only the first block. Keep domain planner and legacy APIs
for compatibility and their rule coverage; remove their obsolete UI workflows.

Verification: unit tests for summary/timing/export; browser tests for calendar
CRUD, persistence, two-view navigation, completion/undo, overlap rejection,
cross-account isolation and focus timer. Update obsolete UI tests to the new
user journey, retain generator coverage through its API. Both adapter builds,
lint/types and CI remain required. Apply additive migration before production.
