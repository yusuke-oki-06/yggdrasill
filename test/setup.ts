import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll } from "vitest";

let isolatedUserClaude: string;

beforeAll(async () => {
  isolatedUserClaude = await fs.mkdtemp(path.join(os.tmpdir(), "yggdrasil-user-"));
  process.env.YGGDRASIL_USER_CLAUDE_DIR = isolatedUserClaude;
});

afterAll(async () => {
  if (isolatedUserClaude) {
    await fs.rm(isolatedUserClaude, { recursive: true, force: true });
  }
  delete process.env.YGGDRASIL_USER_CLAUDE_DIR;
});
