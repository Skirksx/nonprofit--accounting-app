import assert from "node:assert/strict";
import test from "node:test";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { convertPlaceholders, isMainModule, resolvePort } from "../src/renderServer.ts";

test("uses Render PORT when provided", () => {
  assert.equal(resolvePort({ PORT: "10000" }), 10000);
});

test("falls back to 3000 for local development", () => {
  assert.equal(resolvePort({}), 3000);
  assert.equal(resolvePort({ PORT: "not-a-port" }), 3000);
});

test("detects when the server file is the main entry point", () => {
  const filePath = resolve("dist/server.js");

  assert.equal(isMainModule(pathToFileURL(filePath).href, filePath), true);
});

test("converts D1 placeholders to PostgreSQL placeholders", () => {
  assert.equal(
    convertPlaceholders("SELECT * FROM users WHERE id = ? AND email = ?"),
    "SELECT * FROM users WHERE id = $1 AND email = $2"
  );
});
