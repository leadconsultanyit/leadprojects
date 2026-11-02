// Shared milestone money logic, used by both the Admin and Business dashboards so
// the two never drift apart.
//
// Milestone amounts are stored as absolute values but represent a PERCENT of a
// "billing base". The base is the client-approved budget once a project is won
// (the real contract value we invoice against), otherwise the latest proposal
// revision. Each milestone also stores its `percent` so amounts can be recomputed
// exactly if the base later changes.

// Latest proposal value: revisions[] is append-only (revisions[0] is the original
// "Initial proposal"), so the last entry is current; proposalValue/totalProposedMoney
// are kept in sync and act as fallbacks for older projects.
export const baseProposalValue = (p) => {
  if (!p) return 0;
  const revs = p.revisions || [];
  return (revs.length > 0 && revs[revs.length - 1]?.amount) || p.proposalValue || p.totalProposedMoney || 0;
};

// The value milestone amounts should be a % of: approved budget when set, else the
// latest proposal value.
export const milestoneBase = (p) => {
  if (!p) return 0;
  return (p.approvedBudget && p.approvedBudget > 0) ? p.approvedBudget : baseProposalValue(p);
};

// Recover the base that EXISTING (legacy) stored amounts were computed against,
// for milestones that have no saved `percent`. A project's amounts were computed
// off one of a few candidate values (approved budget, latest/original proposal
// revision, proposal value) but which one isn't recorded, so we pick the candidate
// that makes the milestone percentages sum closest to 100% — the base they were
// genuinely a percentage of. (With `percent` saved this is never needed.)
export const recoverBase = (p) => {
  const fallback = baseProposalValue(p);
  const fms = (p?.financialMilestones || []).filter(f => f.title && f.title.trim());
  if (!fms.length) return fallback;
  const revs = p.revisions || [];
  const candidates = [p.approvedBudget, revs[revs.length - 1]?.amount, revs[0]?.amount, p.proposalValue, p.totalProposedMoney]
    .filter(v => v && v > 0);
  let best = fallback, bestErr = Infinity;
  for (const b of candidates) {
    const sumPct = fms.reduce((s, f) => s + (f.amount / b) * 100, 0);
    const err = Math.abs(sumPct - 100);
    if (err < bestErr - 0.01) { bestErr = err; best = b; }
  }
  return best;
};

// Percent a stored milestone represents: its saved `percent` if present, else
// derived from its amount against the recovered base.
export const milestonePercent = (p, fm) => {
  if (fm.percent != null && fm.percent !== '') return fm.percent;
  const src = recoverBase(p);
  return src > 0 ? Math.round((fm.amount / src) * 1000) / 10 : (fm.amount || 0);
};

// Serialize milestone rows for saving: the row `amount` field holds a percent; we
// renumber FM/TM ids by position (always sequential and in order), store the
// percent, and compute the absolute amount off the billing base.
export const serializeMilestones = (project, rows) => {
  const base = milestoneBase(project);
  return rows
    .filter(fm => fm.title.trim())
    .map((fm, idx) => {
      const pct = Number(fm.amount) || 0;
      return {
        ...fm,
        financialMilestoneId: `FM-${idx + 1}`,
        percent: pct,
        amount: base > 0 ? Math.round((pct / 100) * base) : pct,
        status: 'pending',
        technicalMilestones: fm.technicalMilestones
          .filter(tm => tm.title.trim())
          .map((tm, j) => ({
            ...tm,
            technicalMilestoneId: `TM-${idx + 1}-${j + 1}`,
            status: 'pending',
            expectedDate: tm.expectedDate || null
          }))
      };
    });
};
