import "server-only";
import { DateTime } from "luxon";
import type { Account } from "next-auth";
import type { JWT } from "next-auth/jwt";

export namespace MicrosoftEntraID {
  async function refresh(account: Account): Promise<Account> {
    console.log("Refreshing token for account. ", account);

    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      throw new Error(
        "CLIENT_ID and CLIENT_SECRET must be set in environment variables to refresh tokens.",
      );
    }
    if (!account.refresh_token) {
      return account;
    }

    // https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow#refresh-the-access-token
    const resp = await fetch(
      `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: account.refresh_token,
        }),
      },
    );

    if (!resp.ok) {
      throw new Error(
        `Failed to refresh token: ${resp.status} ${resp.statusText}\n` +
          `${await resp.text()}`,
      );
    }

    const tokens = await resp.json();

    const newAccount = {
      ...account,
      ...tokens,

      ...(tokens.expires_in
        ? {
            expires_at: DateTime.now()
              .plus({ seconds: tokens.expires_in })
              .toSeconds(),
          }
        : {}),
    };

    console.log("Refreshed token for account. ", newAccount);
    return newAccount;
  }

  export async function maybeRefresh(token: JWT): Promise<JWT> {
    const account = token.account;
    if (
      account.expires_at &&
      DateTime.fromSeconds(account.expires_at).diffNow().as("seconds") < 10 * 60
    ) {
      return { ...token, account: await refresh(account) };
    } else {
      return token;
    }
  }
}
