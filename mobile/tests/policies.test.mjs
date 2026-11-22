import { test } from "node:test";
import assert from "node:assert/strict";
import { nativeLinkTarget, shareExtension } from "../src/policies.ts";
test("deep links only navigate to supported app routes", () => {
  assert.equal(
    nativeLinkTarget("movenotes://community/join/test-token"),
    "/community/join/test-token",
  );
  assert.equal(
    nativeLinkTarget("movenotes://auth/email-change?code=test"),
    "/auth/email-change?code=test",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://evil.example/auth/email-change",
    "movenotes://admin",
    "bad-url",
    "movenotes://community/join/a/extra",
  ])
    assert.equal(nativeLinkTarget(url), null);
});
test("share adapters preserve formats and reject unsupported files", () => {
  assert.equal(shareExtension("image/png"), "png");
  assert.equal(shareExtension("image/jpeg"), "jpg");
  assert.equal(shareExtension("application/json"), "json");
  assert.throws(() => shareExtension("text/html"));
});
