import { TRPCError } from "@trpc/server";
import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import * as jose from "jose";

function EntraIDIssuer(tid: string) {
  return `https://sts.windows.net/${tid}/`;
}

function JWKS(tid: string) {
  return `https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`;
}

// * Refer to .env.example for information on the environment variables.
const CLIENT_ID = Bun.env.CLIENT_ID;
if (!CLIENT_ID) {
  throw new Error("Missing env CLIENT_ID");
}
const UST_HK_TENANT_ID = Bun.env.UST_HK_TENANT_ID;
if (!UST_HK_TENANT_ID) {
  throw new Error("Missing env UST_HK_TENANT_ID");
}
const CONNECT_UST_HK_TENANT_ID = Bun.env.CONNECT_UST_HK_TENANT_ID;
if (!CONNECT_UST_HK_TENANT_ID) {
  throw new Error("Missing env CONNECT_UST_HK_TENANT_ID");
}
const DEBUG_TENANT_ID = Bun.env.DEBUG_TENANT_ID;
if (!DEBUG_TENANT_ID) {
  throw new Error("Missing env DEBUG_TENANT_ID");
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

function formatName(family_name: string, given_name: string, name: string) {
  if (family_name && given_name) {
    return `${family_name}, ${given_name}`;
  }
  return name;
}

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
      const { upn } = jose.decodeJwt(token);
      if (!upn || typeof upn !== "string") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Malformed JWT (missing or malformed upn claim)",
        });
      }
      const host = (() => {
        try {
          return new URL(`email://${upn}`).host;
        } catch (e) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Malformed JWT (malformed upn claim)",
            cause: e,
          });
        }
      })();

      const verification =
        Verification[host as keyof typeof Verification] ?? Verification[""];
      const { payload } = await jose.jwtVerify(token, verification.jwks, {
        audience: CLIENT_ID,
        issuer: verification.issuer,
      });
      // payload should be a Microsoft Entra ID v1.0 Access Token.
      // Ref:
      // https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference

      const { family_name, given_name, name } = payload;
      if (!upn || typeof upn !== "string") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Malformed JWT (missing or malformed upn claim)",
        });
      }
      if (
        family_name === undefined ||
        given_name === undefined ||
        typeof family_name !== "string" ||
        typeof given_name !== "string"
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Malformed JWT (missing or malformed family_name and given_name claims)",
        });
      }
      if (name === undefined || typeof name !== "string") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Malformed JWT (missing or malformed name claim)",
        });
      }

      return {
        email: upn,
        name: formatName(family_name, given_name, name),
      };
    } catch (e) {
      if (e instanceof TRPCError) {
        throw e;
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
