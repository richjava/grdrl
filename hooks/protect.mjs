#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROTECTED_BASENAMES = new Set([
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "grdrl.json",
  "grdrl.exceptions.json",
]);

const SUPPRESSION = /^(?:eslint-disable-next-line|eslint-disable-line|eslint-disable|@ts-nocheck|@ts-ignore)\b/;

const DENY_MESSAGE =
  "Blocked: this edit weakens lint enforcement. Fix the code so the existing rule passes. Policy changes belong in a reviewed update to grdrl.json.";

export function evaluateHook(input) {
  if (!input || typeof input !== "object") {
    return allow();
  }

  const command = shellCommand(input);
  if (command !== null) {
    return commandWritesProtectedFile(command) ? deny() : allow();
  }

  const filePath = filePathFrom(input);
  const contents = contentsFrom(input);
  if (filePath && isProtectedPath(filePath)) {
    return deny();
  }
  if (contents.some((chunk) => commentHasSuppression(chunk))) {
    return deny();
  }
  return allow();
}

export function isProtectedPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (PROTECTED_BASENAMES.has(path.posix.basename(normalized))) {
    return true;
  }
  if (/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(normalized)) {
    return true;
  }
  return (
    normalized.endsWith("/hooks/protect.mjs") ||
    normalized.endsWith("/.cursor/hooks.json") ||
    normalized.endsWith("/.claude/settings.json")
  );
}

function shellCommand(input) {
  if (typeof input.command === "string") {
    return input.command;
  }
  const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
  const toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  if (toolName === "Shell" || toolName === "Bash") {
    return typeof toolInput.command === "string" ? toolInput.command : "";
  }
  return null;
}

function commandWritesProtectedFile(command) {
  const writes = /(>>?|\btee\b|\bsed\s+-i|\brm\b|\bmv\b)/.test(command);
  if (!writes) {
    return false;
  }
  return /eslint\.config\.[cm]?[jt]s|\.eslintrc|grdrl\.json|grdrl\.exceptions\.json|\.github\/workflows\/|hooks\/protect\.mjs/.test(
    command,
  );
}

function filePathFrom(input) {
  const toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  const candidates = [toolInput.path, toolInput.file_path, toolInput.target_file, input.file_path];
  return candidates.find((candidate) => typeof candidate === "string") ?? "";
}

function contentsFrom(input) {
  const toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  const chunks = [toolInput.contents, toolInput.content, toolInput.new_string, toolInput.new_str];
  const edits = Array.isArray(toolInput.edits) ? toolInput.edits : [];
  for (const edit of edits) {
    if (edit && typeof edit === "object") {
      chunks.push(edit.new_string, edit.new_str);
    }
  }
  return chunks.filter((chunk) => typeof chunk === "string");
}

function commentHasSuppression(text) {
  const comments = text.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g);
  for (const match of comments) {
    const comment = match[0];
    const body = comment.startsWith("//") ? comment.slice(2) : comment.slice(2, -2);
    if (SUPPRESSION.test(body.trimStart())) {
      return true;
    }
  }
  return false;
}

function allow() {
  return { permission: "allow" };
}

function deny() {
  return {
    permission: "deny",
    user_message: DENY_MESSAGE,
    agent_message: DENY_MESSAGE,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: DENY_MESSAGE,
    },
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  const raw = await readStdin();
  let payload = {};
  if (raw.trim().length > 0) {
    try {
      payload = JSON.parse(raw);
    } catch {
      process.stderr.write("grdrl hook ignored an unreadable payload.\n");
      process.stdout.write(`${JSON.stringify(allow())}\n`);
      process.exit(0);
    }
  }
  process.stdout.write(`${JSON.stringify(evaluateHook(payload))}\n`);
}
