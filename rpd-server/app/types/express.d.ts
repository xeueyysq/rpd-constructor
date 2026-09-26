import type { JwtPayload } from "jsonwebtoken";

export interface UserClaims extends JwtPayload {
  id: number;
  role: number;
  userName: string;
}

export interface RequestFingerprint {
  hash: string | null;
  components: Record<string, unknown>;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: UserClaims;
    fingerprint?: RequestFingerprint;
  }
}
