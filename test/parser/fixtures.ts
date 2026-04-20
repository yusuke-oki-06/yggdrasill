import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export async function makeFixture(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "yggdrasil-fx-"));

  await fs.mkdir(path.join(root, ".claude", "skills", "example-skill"), { recursive: true });
  await fs.mkdir(path.join(root, ".claude", "rules"), { recursive: true });

  await fs.writeFile(
    path.join(root, ".claude", "settings.json"),
    JSON.stringify(
      {
        env: { FEATURE_FLAG: "on" },
        enabledPlugins: {
          "playwright@claude-plugins-official": true,
        },
        permissions: {
          allow: ["Bash(npm test)"],
          deny: ["Bash(rm -rf *)"],
        },
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo pre-bash" }],
            },
          ],
          NotARealEvent: [
            { hooks: [{ command: "noop" }] },
          ],
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    path.join(root, ".claude", "skills", "example-skill", "SKILL.md"),
    `---
name: example-skill
description: An example skill for tests
license: MIT
metadata:
  version: "0.0.1"
---

Body content.
`,
  );

  await fs.writeFile(
    path.join(root, ".claude", "rules", "typescript.md"),
    "Prefer strict mode.",
  );

  await fs.writeFile(
    path.join(root, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          github: {
            type: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_PAT}" },
          },
          notion: { type: "http", url: "https://mcp.notion.com/mcp" },
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(path.join(root, "CLAUDE.md"), "# CLAUDE.md");
  await fs.writeFile(path.join(root, "AGENTS.md"), "# AGENTS.md");

  const memoryDir = path.join(root, "memory");
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.writeFile(
    path.join(memoryDir, "user-role.md"),
    `---
name: user-role
description: User is a developer
type: user
---

Body.
`,
  );
  await fs.writeFile(path.join(memoryDir, "MEMORY.md"), "- index");

  return {
    root,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
