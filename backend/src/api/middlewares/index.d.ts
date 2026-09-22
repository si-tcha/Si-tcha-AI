import { AuthenticatedUser } from '../../types/user.types.js';
import type { UserAccount } from '../../controllers/auth.controller.js';

// to make the file a module and avoid the TypeScript error
export {}

declare global {
  namespace Express {
    export interface Request {
      user?: AuthenticatedUser;
    }
  }
}
