import { TRPCError } from "@trpc/server";
import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import * as jose from "jose";

function EntraIDIssuer(tid: string) {
  return `https://login.microsoftonline.com/${tid}/v2.0`;
}

function JWKS(tid: string) {
  return `https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`;
}

// * Refer to .env.example for information on the environment variables.
const ID = Bun.env.MICROSOFT_ENTRA_ID_CLIENT_ID;
if (!ID) {
  throw new Error("Missing env MICROSOFT_ENTRA_ID_CLIENT_ID");
}
const UST_HK_TENANT_ID = Bun.env.MICROSOFT_ENTRA_ID_UST_HK_TENANT_ID;
if (!UST_HK_TENANT_ID) {
  throw new Error("Missing env MICROSOFT_ENTRA_ID_UST_HK_TENANT_ID");
}
const CONNECT_UST_HK_TENANT_ID =
  Bun.env.MICROSOFT_ENTRA_ID_CONNECT_UST_HK_TENANT_ID;
if (!CONNECT_UST_HK_TENANT_ID) {
  throw new Error("Missing env MICROSOFT_ENTRA_ID_CONNECT_UST_HK_TENANT_ID");
}
const DEBUG_TENANT_ID = Bun.env.MICROSOFT_ENTRA_ID_DEBUG_TENANT_ID;
if (!DEBUG_TENANT_ID) {
  throw new Error("Missing env MICROSOFT_ENTRA_ID_DEBUG_TENANT_ID");
}

const Verification = {
  "ust.hk": {
    tenant: UST_HK_TENANT_ID,
    issuer: EntraIDIssuer(UST_HK_TENANT_ID),
    jwks: jose.createRemoteJWKSet(new URL(JWKS(UST_HK_TENANT_ID))),
  },
  "connect.ust.hk": {
    tenant: CONNECT_UST_HK_TENANT_ID,
    issuer: EntraIDIssuer(CONNECT_UST_HK_TENANT_ID),
    jwks: jose.createRemoteJWKSet(new URL(JWKS(CONNECT_UST_HK_TENANT_ID))),
  },
  "": {
    tenant: DEBUG_TENANT_ID,
    issuer: EntraIDIssuer(DEBUG_TENANT_ID),
    jwks: jose.createRemoteJWKSet(new URL(JWKS(DEBUG_TENANT_ID))),
  },
};

export async function createContext({ req }: CreateHTTPContextOptions) {
  async function auth() {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Missing Authorization Header",
      });
    }
    if (!authHeader.startsWith("Bearer ")) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Malformed Authorization Header (missing Bearer prefix)",
      });
    }
    const token = authHeader.replace(/^Bearer /, "");
    try {
      const { email } = jose.decodeJwt(token);
      if (!email || typeof email !== "string") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Malformed JWT (missing email claim)",
        });
      }
      const [, domain] = email.split("@");
      if (!domain) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Malformed JWT (malformed email claim)",
        });
      }

      const verification =
        Verification[domain as keyof typeof Verification] ?? Verification[""];
      const { payload } = await jose.jwtVerify(token, verification.jwks, {
        audience: ID,
        issuer: verification.issuer,
      });
      return {
        email: String(payload.email),
        name: String(payload.name),
      };
    } catch (e) {
      if (e instanceof TRPCError) {
        throw e;
      }
      if (e instanceof jose.errors.JWTExpired) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "JWT Expired",
          cause: e,
        });
      }
      if (e instanceof jose.errors.JOSEError) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `JWT Verification Error: ${e.message}`,
          cause: e,
        });
      }
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: `Unknown Error during JWT Verification: ${String(e)}`,
        cause: e,
      });
    }
  }
  const user = await auth();
  return {
    user,
  };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
