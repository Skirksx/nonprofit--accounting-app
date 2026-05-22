import assert from "node:assert/strict";
import test from "node:test";

import {
  logoFileToDataUrl,
  validatePasswordFields,
  validateProfileName
} from "../src/settings.ts";

test("validates profile name changes", () => {
  const form = new FormData();
  form.set("name", "Staci Kirk");

  const result = validateProfileName(form);

  assert.deepEqual(result, {
    ok: true,
    data: { name: "Staci Kirk" }
  });
});

test("rejects weak or mismatched password changes", () => {
  const form = new FormData();
  form.set("currentPassword", "");
  form.set("newPassword", "short");
  form.set("confirmPassword", "different");

  const result = validatePasswordFields(form);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.currentPassword, "Current password is required.");
    assert.equal(result.errors.newPassword, "Use at least 12 characters.");
    assert.equal(result.errors.confirmPassword, "Passwords do not match.");
  }
});

test("converts a small png logo to a data url", async () => {
  const file = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", {
    type: "image/png"
  });

  const result = await logoFileToDataUrl(file);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.logoDataUrl, "data:image/png;base64,iVBORw==");
  }
});

test("rejects unsupported logo file types", async () => {
  const file = new File(["hello"], "logo.txt", {
    type: "text/plain"
  });

  const result = await logoFileToDataUrl(file);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.logo, "Logo must be PNG, JPG, WEBP, or GIF.");
  }
});

test("rejects logos larger than 1.5 MB", async () => {
  const file = new File([new Uint8Array(1_500_001)], "large-logo.png", {
    type: "image/png"
  });

  const result = await logoFileToDataUrl(file);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.logo, "Logo must be 1.5 MB or smaller.");
  }
});
