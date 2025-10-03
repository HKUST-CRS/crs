import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import * as jose from "jose";
import { JWTClaimValidationFailed } from "jose/errors";

function EntraIDIssuer(tid: string) {
  return `https://login.microsoftonline.com/${tid}/v2.0`;
}

function JWKS(tid: string) {
  return `https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`;
}

// * Refer to .env.example for information on the environment variables.

const ID = Bun.env.MICROSOFT_ENTRA_ID_CLIENT_ID;
const HKUST_TENANT_ID = Bun.env.MICROSOFT_ENTRA_ID_HKUST_TENANT_ID;
const DEBUG_TENANT_ID = Bun.env.MICROSOFT_ENTRA_ID_DEBUG_TENANT_ID;
if (!ID) {
  throw new Error("Missing env MICROSOFT_ENTRA_ID_CLIENT_ID");
}
if (!HKUST_TENANT_ID) {
  throw new Error("Missing env MICROSOFT_ENTRA_ID_HKUST_TENANT_ID");
}
if (!DEBUG_TENANT_ID) {
  throw new Error("Missing env MICROSOFT_ENTRA_ID_DEBUG_TENANT_ID");
}
const HKUST_ISSUER = EntraIDIssuer(HKUST_TENANT_ID);
const DEBUG_ISSUER = EntraIDIssuer(DEBUG_TENANT_ID);

const HKUST_JWKS = jose.createRemoteJWKSet(new URL(JWKS(HKUST_TENANT_ID)));
const DEBUG_JWKS = jose.createRemoteJWKSet(new URL(JWKS(DEBUG_TENANT_ID)));

export async function createContext({ req }: CreateHTTPContextOptions) {
  async function auth() {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace(/^Bearer /, "");
      try {
        const { payload } = await jose.jwtVerify(token, HKUST_JWKS, {
          audience: ID,
          issuer: HKUST_ISSUER,
        });
        return {
          email: String(payload.email),
          name: String(payload.name),
        };
      } catch (outer) {
        if (outer instanceof JWTClaimValidationFailed) {
          // Try Debug Tenant
          try {
            const { payload } = await jose.jwtVerify(token, DEBUG_JWKS, {
              audience: ID,
              issuer: DEBUG_ISSUER,
            });
            return {
              email: String(payload.email),
              name: String(payload.name),
            };
          } catch (inner) {
            console.info("Failed to verify token with Debug Tenant", inner);
            throw outer;
          }
        }
      }
    }
    return null;
  }
  const user = await auth();
  return {
    user,
  };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
