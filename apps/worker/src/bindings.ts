export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  KV: KVNamespace;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRES_IN?: string;
  JWT_REFRESH_EXPIRES_IN?: string;
}
