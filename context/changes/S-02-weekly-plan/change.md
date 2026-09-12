---
change_id: S-02-weekly-plan
title: Weekly plan generation from topics and evening budget
status: impl_reviewed
created: 2026-09-10
updated: 2026-09-12
archived_at: null
---

## Notes

North-star slice from `context/foundation/roadmap.md`. Turns topics plus a weekly
evening budget into dated sessions via the urgency rule in `src/domain/scheduler.ts`.

Identity file written retroactively on 2026-09-12: the change was planned,
implemented and reviewed before `/10x-new` was available in this project, so
`created` carries the plan's date and `status` reflects the artifacts actually
on disk (`plan.md` + `impl-review.md`, no archive).

The `## Progress` section in `plan.md` is a summary table, not the checkbox
format the executor skills parse — see the open finding about that.
