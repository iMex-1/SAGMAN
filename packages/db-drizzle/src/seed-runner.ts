// Run this with: npx wrangler d1 execute sagman --file=./seed.sql
// Or use the seed function directly in a wrangler dev environment.
// This file is a helper for local seeding via tsx + wrangler.

import { seed } from './seed';

async function main() {
  // This assumes D1 binding is available via wrangler
  // For local dev: pnpm wrangler d1 execute sagman --local --file=...
  // For programmatic seeding, use the seed() function from a Worker or wrangler script
  console.log('Use: wrangler d1 execute sagman --local --command="..."');
  console.log('Or call seed(db) with a D1Database instance from within a Worker.');
}

main().catch(console.error);
