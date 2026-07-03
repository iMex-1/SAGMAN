import { createClient } from '@libsql/client';
import { seed } from './seed';

async function main() {
  const dbPath = process.argv[2] || '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9490f4655e2bf01225aa8597629bfdf0ac5b1268b9dfc7a74bfce683ccc1a099.sqlite';

  const client = createClient({ url: `file:${dbPath}` });

  const db = {
    prepare(sql: string) {
      const stmt = client.prepare(sql);
      return {
        bind(...args: any[]) {
          const bound = { sql, args };
          return {
            async run() {
              try {
                stmt.bind(args);
                stmt.run();
                return { success: true };
              } catch (e: any) {
                console.error(`SQL error: ${sql}`, e.message);
                return { success: false };
              }
            },
            async first<T>() {
              try {
                stmt.bind(args);
                const row = stmt.get() as T | undefined;
                return row ?? null;
              } catch {
                return null;
              }
            },
          };
        },
      } as any;
    },
    async batch(stmts: any[]) {
      const results = [];
      for (const stmt of stmts) {
        const r = await stmt.run();
        results.push(r);
      }
      return results;
    },
  };

  await seed(db as any);
  client.close();
}

main().catch(console.error);
