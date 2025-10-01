import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

function validate(email: string): boolean {
  return email.endsWith("@connect.ust.hk") || email.endsWith("@ust.hk");
}

// https://authjs.dev/guides/integrating-third-party-backends
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [MicrosoftEntraID],
  callbacks: {
    async signIn({ profile }) {
      return !!(profile?.email && validate(profile.email));
    },
    async jwt({ token, account }) {
      return { ...token, account: account };
    },
    async session({ session, token }) {
      return { ...session, account: token.account };
    },
    async authorized({ request, auth }) {
      const url = request.nextUrl;
      if (url.pathname === "/login") {
        return true;
      }
      if (auth?.user) {
        return true;
      }
      const redirectTo = new URL("/login", request.url);
      redirectTo.searchParams.set("r", url.href);
      return NextResponse.redirect(redirectTo);
    },
  },
});
