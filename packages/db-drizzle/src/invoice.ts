export async function generateInvoiceNumber(db: D1Database): Promise<string> {
  const year = new Date().getFullYear().toString();
  await db.batch([
    db.prepare(
      `INSERT INTO invoice_counters (year, last_seq) VALUES (?, 0) ON CONFLICT(year) DO NOTHING`,
    ).bind(year),
    db.prepare(
      `UPDATE invoice_counters SET last_seq = last_seq + 1 WHERE year = ?`,
    ).bind(year),
  ]);
  const result = await db.prepare(
    `SELECT last_seq FROM invoice_counters WHERE year = ?`,
  ).bind(year).first<{ last_seq: number }>();
  const seq = result?.last_seq ?? 1;
  return `INV-${year}-${String(seq).padStart(5, '0')}`;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(stmts: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface D1PreparedStatement {
  bind(...args: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T>(): Promise<T | null>;
}

interface D1Result {
  success: boolean;
  meta?: any;
}
