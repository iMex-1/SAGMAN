// State machine: maps each status to valid next statuses
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received:          ['diagnosing', 'cancelled'],
  diagnosing:        ['awaiting_approval', 'in_progress', 'cancelled'],
  awaiting_approval: ['in_progress', 'cancelled'],
  in_progress:       ['waiting_for_parts', 'complete', 'cancelled'],
  waiting_for_parts: ['in_progress', 'cancelled'],
  complete:          ['delivered', 'in_progress'],
  delivered:         [],
  cancelled:         [],
}

export const TERMINAL_STATUSES = ['delivered', 'cancelled']
export const ACTIVE_STATUSES = [
  'received',
  'diagnosing',
  'awaiting_approval',
  'in_progress',
  'waiting_for_parts',
  'complete',
]

export function isTransitionAllowed(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

// A repair is overdue if today > targetCompletionDate and not in terminal/complete state
export function isOverdue(repair: {
  status: string
  targetCompletionDate: Date | null
}): boolean {
  if (!repair.targetCompletionDate) return false
  if (['complete', 'delivered', 'cancelled'].includes(repair.status)) return false
  return new Date() > repair.targetCompletionDate
}

// Compute totals from parts and labor
export function computeTotals(
  parts: Array<{ quantityUsed: number; unitCostAtTime: { toNumber(): number } | number }>,
  labor: Array<{ cost: { toNumber(): number } | number }>,
  discountAmount: { toNumber(): number } | number = 0,
): { partsTotal: number; laborTotal: number; finalTotal: number } {
  const partsTotal = parts.reduce((sum, p) => {
    const cost = typeof p.unitCostAtTime === 'number' ? p.unitCostAtTime : p.unitCostAtTime.toNumber()
    return sum + p.quantityUsed * cost
  }, 0)
  const laborTotal = labor.reduce((sum, l) => {
    const cost = typeof l.cost === 'number' ? l.cost : l.cost.toNumber()
    return sum + cost
  }, 0)
  const discount = typeof discountAmount === 'number' ? discountAmount : discountAmount.toNumber()
  return { partsTotal, laborTotal, finalTotal: partsTotal + laborTotal - discount }
}
