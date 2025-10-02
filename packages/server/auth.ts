import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import * as jose from "jose";

const ID = Bun.env.AUTH_MICROSOFT_ENTRA_ID_ID;
const TENANT = Bun.env.AUTH_MICROSOFT_ENTRA_ID_TENANT;
const ISSUER = Bun.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;

const JWKS = jose.createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`),
);

export async function createContext({ req }: CreateHTTPContextOptions) {
  async function auth() {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace(/^Bearer /, "");
      const { payload } = await jose.jwtVerify(token, JWKS, {
        audience: ID,
        issuer: ISSUER,
      });
      return {
        email: payload.email,
        name: payload.name,
      };
    }
    return null;
  }
  const user = await auth();
  return {
    user,
  };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
