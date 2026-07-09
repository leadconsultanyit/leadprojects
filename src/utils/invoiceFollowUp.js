// Invoice-collection follow-up logic shared by the admin & employee dashboards.
//
// Once a financial milestone's invoice is raised (status 'in_progress'), the
// SPOC is expected to log a follow-up remark at the 7th, 20th, 30th and 45th
// day from the invoice date. If the money is still not collected past 45 days,
// the milestone is flagged critical (red).

export const CHECKPOINT_DAYS = [7, 20, 30, 45];
export const CRITICAL_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// The date collection follow-ups are measured from: invoice date, else the
// date the invoice was raised.
export function invoiceAnchorDate(fm) {
  return fm.invoiceDate || fm.raisedDate || null;
}

// Whole days elapsed since the invoice/raised date (null if not raised).
export function daysElapsed(fm, now = new Date()) {
  const anchor = invoiceAnchorDate(fm);
  if (!anchor) return null;
  return Math.floor((startOfDay(now) - startOfDay(anchor)) / DAY_MS);
}

// The checkpoint days that already have a remark logged against them.
export function checkpointsWithRemark(fm) {
  const set = new Set();
  for (const r of fm.invoiceRemarks || []) {
    if (CHECKPOINT_DAYS.includes(r.dayMarker)) set.add(r.dayMarker);
  }
  return set;
}

// The scheduled calendar date for a given checkpoint day.
export function checkpointDate(fm, dayMarker) {
  const anchor = invoiceAnchorDate(fm);
  if (!anchor) return null;
  return new Date(startOfDay(anchor).getTime() + dayMarker * DAY_MS);
}

// Full follow-up status for a raised (in_progress) milestone.
export function invoiceFollowUpStatus(fm, now = new Date()) {
  const elapsed = daysElapsed(fm, now);
  const withRemark = checkpointsWithRemark(fm);
  // Checkpoints reached (elapsed >= day) that still need a remark.
  const dueCheckpoints = elapsed == null
    ? []
    : CHECKPOINT_DAYS.filter(d => elapsed >= d && !withRemark.has(d));
  // Next checkpoint not yet reached.
  const nextCheckpoint = elapsed == null
    ? CHECKPOINT_DAYS[0]
    : (CHECKPOINT_DAYS.find(d => elapsed < d) ?? null);
  const nextDueDate = nextCheckpoint != null ? checkpointDate(fm, nextCheckpoint) : null;
  const critical = elapsed != null && elapsed > CRITICAL_DAYS;
  const snoozed = !!(fm.snoozeUntil && new Date(fm.snoozeUntil) > now);
  const hasDue = dueCheckpoints.length > 0 || critical;
  const alerting = hasDue && !snoozed;
  return { elapsed, dueCheckpoints, nextCheckpoint, nextDueDate, critical, snoozed, alerting, withRemark };
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
