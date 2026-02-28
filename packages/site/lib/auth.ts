import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import NextAuth, { type Account, type Session, type User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import MicrosoftEntraIDProvider from "next-auth/providers/microsoft-entra-id";
import { MicrosoftEntraID } from "./microsoft-entra-id";

const DOMAINS = [
  "connect.ust.hk",
  "ust.hk",
  "flandia.dev", // for debugging purposes
];

function verifyEmail(email?: string): boolean {
  // * A strong verification is done in the backend (server/auth.ts).
  // * Here we just do a simple check to avoid obvious invalid emails.
  return (
    !!email &&
    DOMAINS.some((domain) => email.toLowerCase().endsWith(`@${domain}`))
  );
}

// https://authjs.dev/guides/integrating-third-party-backends
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraIDProvider({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      authorization: {
        params: {
          scope: `openid profile email offline_access ${process.env.CLIENT_ID}/.default`,
        },
      },
      // Override the default profile callback to prepare necessary information
      // for the app. It also prevents from calling Microsoft Graph API to get
      // user profile, which is redundant in our case.
      async profile(profile, _tokens): Promise<User> {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }): Promise<boolean> {
      console.log("Sign in attempt from user.", user);
      return verifyEmail(user.email);
    },
    async jwt({ token, account, user }): Promise<JWT> {
      if (account && user) {
        token.account = account;
        token.user = user;
        console.log("Sign in from user.", user);
        return token;
      }
      return MicrosoftEntraID.maybeRefresh(token);
    },
    async session({ session, token }): Promise<Session> {
      return {
        ...session,
        user: token.user,
        account: token.account,
      };
    },
    async authorized({ request, auth }) {
      const url = request.nextUrl;
      if (url.pathname === "/login") {
        return true;
      }
      if (
        auth &&
        (auth.account.expires_at
          ? DateTime.fromSeconds(auth.account.expires_at)
              .diffNow()
              .as("seconds") > 0
          : true)
      ) {
        return true;
      } else {
        const url = request.nextUrl.clone();
        url.searchParams.set("r", url.pathname + url.search);
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    },
  },
});

declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    email: string;
    image?: undefined;
  }
  interface Session {
    user: User;
    account: Account;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user: User;
    account: Account;
  }
}
