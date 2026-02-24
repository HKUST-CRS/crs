import crypto from "node:crypto";
import {
  CompactSign,
  type CryptoKey,
  exportJWK,
  generateKeyPair,
  importJWK,
  type JWK,
} from "jose";
import { Request } from "./Request";

export namespace Signature {
  const alg = "EdDSA";
  let _key: {
    public: CryptoKey;
    private: CryptoKey;
    kid: string;
  } | null = null;

  async function importKey(
    base64: string,
    type: "private" | "public",
  ): Promise<[CryptoKey, string]> {
    const data: JWK = JSON.parse(
      Buffer.from(base64, "base64").toString("utf-8"),
    );
    if (data.alg !== alg) {
      throw new Error(`JWK alg must be ${alg}, got ${data.alg}`);
    }
    if (!data.kid) {
      throw new Error("JWK must have a kid");
    }
    const imported = await importJWK(data, alg, {
      extractable: true,
    });
    if (imported instanceof Uint8Array) {
      throw new Error("Expected a CryptoKey, got a Uint8Array");
    }
    if (imported.type !== type) {
      throw new Error(`JWK must be a ${type} key`);
    }
    if (imported.type === "private" && !imported.usages.includes("sign")) {
      throw new Error("JWK must be a signing key");
    }
    return [imported, data.kid];
  }

  async function key() {
    if (_key) {
      return _key;
    }
    if (Bun.env.JWK_PRIVATE && Bun.env.JWK_PUBLIC) {
      const [_private, privateKid] = await importKey(
        Bun.env.JWK_PRIVATE,
        "private",
      );
      const [_public, publicKid] = await importKey(
        Bun.env.JWK_PUBLIC,
        "public",
      );
      if (privateKid !== publicKid) {
        throw new Error("JWK public and private keys must have the same kid");
      }
      _key = {
        public: _public,
        private: _private,
        kid: privateKid,
      };
      console.info(
        `Signature Public Key: ${JSON.stringify(await exportJWK(_key.public))}`,
      );
      return _key;
    } else {
      if (Bun.env.NODE_ENV === "production") {
        throw new Error("JWK environment variable is not set in production");
      } else {
        console.warn(
          "JWK environment variable is not set, generating a new JWK for development.",
        );
        const pair = await generateKeyPair("EdDSA", {
          crv: "Ed25519",
          extractable: true,
        });
        _key = {
          public: pair.publicKey,
          private: pair.privateKey,
          kid: "CRS Development",
        };
        console.info(
          `Signature Public Key: ${JSON.stringify(await exportJWK(_key.public))}`,
        );
        return _key;
      }
    }
  }

  export async function sign(r: Request): Promise<string> {
    const rr = Request.parse(structuredClone(r));
    rr.details.proof = rr.details.proof?.map((p) => {
      const hash = crypto.createHash("sha256");
      hash.update(Buffer.from(p.content, "base64"));
      return {
        ...p,
        content: hash.digest("hex"),
      };
    });
    const jws = await new CompactSign(
      new TextEncoder().encode(JSON.stringify(rr)),
    )
      .setProtectedHeader({
        alg,
        typ: "JOSE",
        kid: (await key()).kid,
      })
      .sign((await key()).private);
    return jws;
  }
}
