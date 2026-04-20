import { describe, expect, it } from "vitest";
import { detectInputRequired, projectSlug, readTail } from "../../src/watchers/sessionsParser.js";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe("projectSlug", () => {
  it("converts a Windows path to the Claude Code slug format", () => {
    expect(projectSlug("C:\\Users\\koori\\development\\yggdrasill")).toBe(
      "C--Users-koori-development-yggdrasill",
    );
  });

  it("converts a posix path to the slug format", () => {
    expect(projectSlug("/home/koori/dev/yggdrasill")).toBe("home-koori-dev-yggdrasill");
  });
});

describe("detectInputRequired", () => {
  it("detects AskUserQuestion in an assistant tool_use line", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "thinking" },
          { type: "tool_use", id: "x", name: "AskUserQuestion", input: {} },
        ],
      },
    });
    expect(detectInputRequired(line)).toBe("AskUserQuestion");
  });

  it("detects ExitPlanMode in an assistant tool_use line", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "x", name: "ExitPlanMode", input: { plan: "..." } }],
      },
    });
    expect(detectInputRequired(line)).toBe("ExitPlanMode");
  });

  it("returns null for a user message", () => {
    const line = JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", content: "ok" }] },
    });
    expect(detectInputRequired(line)).toBeNull();
  });

  it("returns null for an attachment line", () => {
    const line = JSON.stringify({
      type: "attachment",
      attachment: { type: "hook_success", stdout: "{}" },
    });
    expect(detectInputRequired(line)).toBeNull();
  });

  it("returns null for an assistant Bash tool_use", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "x", name: "Bash", input: { command: "ls" } }],
      },
    });
    expect(detectInputRequired(line)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(detectInputRequired("not json")).toBeNull();
  });

  it("short-circuits without parsing when no keyword is present", () => {
    expect(detectInputRequired('{"type":"user","message":{}}')).toBeNull();
  });
});

describe("readTail", () => {
  it("returns the trailing complete lines from a file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "yggdrasil-tail-"));
    const file = path.join(dir, "session.jsonl");
    try {
      const big = "x".repeat(20 * 1024);
      const content = [`{"line":1,"pad":"${big}"}`, `{"line":2}`, `{"line":3}`].join("\n") + "\n";
      await fs.writeFile(file, content, "utf8");
      const lines = await readTail(file, 4096);
      expect(lines.at(-1)).toBe(`{"line":3}`);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(2);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("returns empty array for empty file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "yggdrasil-tail-"));
    const file = path.join(dir, "empty.jsonl");
    try {
      await fs.writeFile(file, "", "utf8");
      expect(await readTail(file)).toEqual([]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
