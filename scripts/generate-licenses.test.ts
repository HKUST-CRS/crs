import { expect, test } from "bun:test";
import { join } from "node:path";

test("license notices cover all three workspaces and regenerate consistently", async () => {
  const root = join(import.meta.dir, "..");
  const output = Bun.file(
    join(root, "packages/site/public/THIRD-PARTY-LICENSES.txt"),
  );
  const generate = async () => {
    const process = Bun.spawn([Bun.argv[0], "run", "licenses"], {
      cwd: root,
      stdout: "ignore",
      stderr: "pipe",
    });
    const errors = await new Response(process.stderr).text();
    expect(await process.exited, errors).toBe(0);
    return output.text();
  };
  const notices = await generate();
  for (const name of ["next", "mongodb", "@trpc/server", "xlsx"]) {
    expect(notices).toContain(` - ${name}@`);
  }
  expect(await generate()).toBe(notices);
});
