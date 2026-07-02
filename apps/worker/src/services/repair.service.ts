export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received:          ['diagnosing', 'cancelled'],
  diagnosing:        ['awaiting_approval', 'in_progress', 'cancelled'],
  awaiting_approval: ['in_progress', 'cancelled'],
  in_progress:       ['waiting_for_parts', 'complete', 'cancelled'],
  waiting_for_parts: ['in_progress', 'cancelled'],
  complete:          ['delivered', 'in_progress'],
  delivered:         [],
  cancelled:         [],
};

export const TERMINAL_STATUSES = ['delivered', 'cancelled'];
export const ACTIVE_STATUSES = [
  'received', 'diagnosing', 'awaiting_approval',
  'in_progress', 'waiting_for_parts', 'complete',
];

export function isTransitionAllowed(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isOverdue(repair: { status: string; targetCompletionDate: string | null }): boolean {
  if (!repair.targetCompletionDate) return false;
  if (['complete', 'delivered', 'cancelled'].includes(repair.status)) return false;
  return new Date() > new Date(repair.targetCompletionDate);
}

export function computeTotals(
  parts: Array<{ quantityUsed: number; unitCostAtTime: number }>,
  labor: Array<{ cost: number }>,
  discountAmount: number = 0,
): { partsTotal: number; laborTotal: number; finalTotal: number } {
  const partsTotal = parts.reduce((sum, p) => sum + p.quantityUsed * p.unitCostAtTime, 0);
  const laborTotal = labor.reduce((sum, l) => sum + l.cost, 0);
  return { partsTotal, laborTotal, finalTotal: partsTotal + laborTotal - discountAmount };
}
