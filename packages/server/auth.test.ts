import { expect, test } from "bun:test";

Bun.env.CLIENT_ID ??= "test-client";
Bun.env.UST_HK_TENANT_ID ??= "test-tenant";
Bun.env.CONNECT_UST_HK_TENANT_ID ??= "test-tenant";
Bun.env.DEBUG_TENANT_ID ??= "test-tenant";

const { createContext } = await import("./auth");
const options = { req: { headers: {} } } as unknown as Parameters<
  typeof createContext
>[0];

test("development user bypasses JWT authentication only outside production", async () => {
  const oldUser = Bun.env.CRS_DEV_USER;
  const oldNodeEnv = Bun.env.NODE_ENV;
  try {
    Bun.env.CRS_DEV_USER = "god@ust.hk";
    Bun.env.NODE_ENV = "development";
    expect(await createContext(options)).toEqual({
      user: { email: "god@ust.hk", name: "god@ust.hk" },
    });

    delete Bun.env.CRS_DEV_USER;
    expect(createContext(options)).rejects.toThrow(
      "Missing Authorization Header",
    );

    Bun.env.CRS_DEV_USER = "not-an-email";
    expect(createContext(options)).rejects.toThrow();

    delete Bun.env.CRS_DEV_USER;
    Bun.env.NODE_ENV = "production";
    expect(createContext(options)).rejects.toThrow(
      "Missing Authorization Header",
    );

    Bun.env.CRS_DEV_USER = "god@ust.hk";
    expect(createContext(options)).rejects.toThrow(
      "CRS_DEV_USER cannot be used in production",
    );
  } finally {
    if (oldUser === undefined) delete Bun.env.CRS_DEV_USER;
    else Bun.env.CRS_DEV_USER = oldUser;
    if (oldNodeEnv === undefined) delete Bun.env.NODE_ENV;
    else Bun.env.NODE_ENV = oldNodeEnv;
  }
});
