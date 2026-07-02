import type { Env } from './bindings';
import type { JwtPayload } from './middleware/auth';

export type AppVariables = {
  user: JwtPayload;
};

export type AppBindings = {
  Bindings: Env;
  Variables: AppVariables;
};
