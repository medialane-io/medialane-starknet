# Notifications components — audit (2026-05-15)

## Files

| File | LOC | Surface |
|---|---|---|
| `src/components/shared/notification-spotlight.tsx` | 207 | Modal — shown once per session for spotlight-priority notifications |
| `src/app/notifications/notifications-feed.tsx` | 147 | Full-page feed at `/notifications` |
| `src/components/layout/notifications-sheet.tsx` | 180 | Bell-icon dropdown sheet in the app header |

## Existing shared modules (already in place)

The big building blocks are already extracted:

- `src/lib/notification-meta.ts` — `NOTIFICATION_ICON`, `NOTIFICATION_COLOR`, `NOTIFICATION_LABEL` maps (single source of truth for type → icon/color/label)
- `src/lib/notification-storage.ts` — localStorage read/write for "seen" tracking
- `src/components/shared/notification-row.tsx` — the unified row component (used by feed + sheet)
- `src/hooks/use-notifications.ts` — the data hook (used by all three)

Spotlight uses `NOTIFICATION_ICON` / `NOTIFICATION_COLOR` / `NOTIFICATION_LABEL` directly and renders its own card layout (full-screen modal, different from a row). Feed and sheet both use `NotificationRow`.

## Remaining duplication

Two tiny helpers are duplicated in `notifications-feed.tsx` and `notifications-sheet.tsx`:

1. **`dayLabel(timestamp)`** — formats a timestamp as "Today" / "Yesterday" / weekday / month-day.
   - Feed uses `month: "long"` (full-page, room for "January 5")
   - Sheet uses `month: "short"` (compact dropdown, "Jan 5")
   - The split is a **deliberate UI choice per surface**.

2. **`groupByDay(items)`** — groups a notification list by day label into a `[label, items[]][]` array.
   - Functionally identical between feed and sheet
   - Only param names differ (`items` vs `notifications`, `arr` vs `existing`)
   - Depends on the per-surface `dayLabel`

## DECISION

**No refactor.** Two helpers × two callsites is below the threshold where shared abstraction pays off (memory: `feedback_no_premature_constants.md` — "three similar lines is better than premature abstraction"). Abstracting `groupByDay` to a shared util would require either:
- A parameter for `dayLabel` (each caller passes its own formatter — adds indirection)
- A single canonical format (drops the deliberate per-surface UI difference)

Both worse than the current honest duplication.

If a third notification surface lands in the future (e.g. a mobile-app PWA notification list), reconsider — that'd be the right time to extract a `useNotificationGroups(items, format: "long" | "short")` hook.

## RATIONALE

The expensive-to-fix problems (icon/color/label drift across surfaces, read-state inconsistency, row rendering divergence) are already prevented by the existing shared modules. The remaining duplication is the right amount: it documents the deliberate per-surface UI choices without coupling them.
