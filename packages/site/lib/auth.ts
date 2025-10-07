import * as jose from "jose";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import NextAuth, { type Account, type Session } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

function validateEmail(email: string): boolean {
  // * A strong verification is done in the backend (server/auth.ts).
  // * Here we just do a simple check to avoid obvious invalid emails.
  return (
    email.endsWith("@connect.ust.hk") ||
    email.endsWith("@ust.hk") ||
    email.endsWith("@flandia.dev") // for debugging purposes
  );
}

export function validateSession(session: Session | null | undefined): boolean {
  const email = session?.user?.email;
  console.log(`[Session ${email}] Validating session...`);

  const id_token = session?.account?.id_token;
  if (!id_token) {
    console.log(`[Session ${email}] No id_token in session.`);
    return false;
  }
  try {
    const jwt = jose.decodeJwt(id_token);
    if (!jwt.exp) {
      console.log(`[Session ${email}] No exp claim in id_token.`);
      return true; // it never expires
    }
    const expireAt = DateTime.fromSeconds(jwt.exp);
    const now = DateTime.now();
    console.log(
      `[Session ${email}] ` +
        `Expires at ${expireAt.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}. ` +
        `Current time is ${now.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}. `,
    );
    return now < expireAt;
  } catch (e) {
    console.log(`[Session ${email}] Invalid id_token in session.`, e);
    return false;
  }
}

// https://authjs.dev/guides/integrating-third-party-backends
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [MicrosoftEntraID],
  callbacks: {
    async signIn({ profile }) {
      console.log("Sign-in attempt:", profile);
      return !!(profile?.email && validateEmail(profile.email));
    },
    async jwt({ token, account }) {
      if (account?.provider === "microsoft-entra-id") {
        return { ...token, account: account };
      }
      return token;
    },
    async session(params) {
      return {
        ...params.session,
        account: params.token.account,
      };
    },
    async authorized({ request, auth }) {
      const url = request.nextUrl;
      if (url.pathname === "/login") {
        return true;
      }
      if (validateSession(auth)) {
        return true;
      }
      console.log("Unauthorized. Redirecting to login...");
      const redirectTo = new URL("/login", request.url);
      redirectTo.searchParams.set("r", url.href);
      return NextResponse.redirect(redirectTo);
    },
  },
});

declare module "next-auth" {
  interface Session {
    account: Account | null;
  }
}
