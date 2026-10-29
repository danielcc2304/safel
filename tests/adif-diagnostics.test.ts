import assert from "node:assert/strict";
import { test } from "node:test";
import { adifFailure } from "../server/adif-diagnostics.ts";

test("Adif diagnostics distinguish HTTP rejection, timeout, connection and parsing failures", () => {
  assert.match(adifFailure(new Error("HTTP 403"), "download"), /HTTP 403/);
  assert.match(
    adifFailure(new DOMException("late", "TimeoutError"), "download"),
    /9 segundos/,
  );
  assert.match(
    adifFailure(
      new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } }),
      "download",
    ),
    /ENOTFOUND/,
  );
  assert.match(
    adifFailure(
      new TypeError("fetch failed", {
        cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
      }),
      "download",
    ),
    /UNABLE_TO_VERIFY_LEAF_SIGNATURE/,
  );
  assert.match(adifFailure(new Error("bad HTML"), "parse"), /HTML/);
});

test("arbitrary upstream error messages, HTML and unknown cause codes are never exposed", () => {
  const sensitive = "private token and upstream HTML";
  assert.ok(!adifFailure(new Error(sensitive), "download").includes(sensitive));
  assert.ok(
    !adifFailure({ cause: { code: sensitive } }, "download").includes(
      sensitive,
    ),
  );
  assert.ok(!adifFailure(null, "download").includes("null"));
});
