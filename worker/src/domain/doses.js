// Dose tracking (rows #6, #7) — pure helpers, no I/O.

// Row #6: the four states a scheduled dose can be in.
export const DOSE_STATUSES = ['pending', 'taken', 'missed', 'skipped']
export const DOSE_PERIODS = ['morning', 'afternoon', 'night']

export const PERIOD_TIME_COLUMN = {
  morning: 'morning_time',
  afternoon: 'afternoon_time',
  night: 'night_time',
}

// Row #9: stock units to apply when a dose slot moves prev -> next status.
// Only "taken" consumes stock; undoing a "taken" restores it. Everything else
// (pending/missed/skipped) leaves stock untouched.
//   returns negative to consume, positive to restore, 0 for no change.
export function stockDeltaForTransition(prevStatus, nextStatus, unitsPerDose) {
  const units = Number(unitsPerDose)
  if (!Number.isFinite(units) || units < 0) return 0
  const wasTaken = prevStatus === 'taken'
  const nowTaken = nextStatus === 'taken'
  if (wasTaken === nowTaken) return 0
  return nowTaken ? -units : units
}

// Row #7: a dose is timestamped only when it is actually taken.
export const takenTimestamp = (status, now) => (status === 'taken' ? now : null)
