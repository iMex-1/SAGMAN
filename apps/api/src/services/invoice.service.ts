import { PrismaClient } from '@sagman/db'

export class InvoiceService {
  /**
   * Generate the next invoice number for the current year.
   * Format: INV-YYYY-XXXXX (zero-padded 5 digits)
   * Uses Prisma's upsert + $executeRaw for atomic increment.
   */
  static async generateNumber(prisma: PrismaClient): Promise<string> {
    const year = new Date().getFullYear()

    // Ensure the row exists first
    await prisma.invoiceCounter.upsert({
      where: { year },
      create: { year, lastSeq: 0 },
      update: {},
    })

    // Atomically increment
    await prisma.$executeRaw`
      UPDATE invoice_counters SET last_seq = last_seq + 1 WHERE year = ${year}
    `

    const counter = await prisma.invoiceCounter.findUnique({ where: { year } })
    const seq = counter?.lastSeq ?? 1

    return `INV-${year}-${String(seq).padStart(5, '0')}`
  }
}
