import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import NextAuth, { type Account } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

function validate(email: string): boolean {
  // * A strong verification is done in the backend (server/auth.ts).
  // * Here we just do a simple check to avoid obvious invalid emails.
  return (
    email.endsWith("@connect.ust.hk") ||
    email.endsWith("@ust.hk") ||
    email.endsWith("@flandia.dev") // for debugging purposes
  );
}

// https://authjs.dev/guides/integrating-third-party-backends
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [MicrosoftEntraID],
  callbacks: {
    async signIn(params) {
      console.log("Sign-in attempt:", params);
      const { profile } = params;
      console.log({
        profile,
        validation: profile?.email && validate(profile.email),
      });
      return !!(profile?.email && validate(profile.email));
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
      console.log(
        `Checking authorization. ` +
          `Expires at ${DateTime.fromSeconds(auth?.account?.expires_at ?? 0).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}. ` +
          `Current time is ${DateTime.now().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}. `,
      );
      if (
        auth?.account?.expires_at &&
        Date.now() < auth.account.expires_at * 1000
      ) {
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
