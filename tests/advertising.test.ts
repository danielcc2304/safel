import assert from "node:assert/strict";
import { test } from "node:test";
import { advertisingConfig, adsTxt } from "../src/lib/advertising.ts";

const configured = {
  VITE_ADS_MODE: "live",
  VITE_ADSENSE_CLIENT: "ca-pub-1234567890123456",
  VITE_ADSENSE_SLOT: "1234567890",
  VITE_ADSENSE_CMP_READY: "true",
};
test("advertising defaults to local preview and production off, without real requests", () => {
  assert.equal(advertisingConfig({}, true).mode, "preview");
  assert.equal(advertisingConfig({}, false).mode, "off");
  assert.equal(advertisingConfig(configured, true).mode, "off");
  assert.equal(
    advertisingConfig({ ...configured, VITE_ADS_MODE: "preview" }, false).mode,
    "preview",
  );
});
test("live advertising requires explicit activation, valid AdSense identifiers and configured CMP", () => {
  assert.equal(advertisingConfig(configured, false).mode, "live");
  for (const override of [
    { VITE_ADS_MODE: "off" },
    { VITE_ADS_MODE: "unknown" },
    { VITE_ADSENSE_CLIENT: "ca-app-pub-1234567890123456~1234567890" },
    { VITE_ADSENSE_CLIENT: "ca-pub-0000000000000000" },
    { VITE_ADSENSE_SLOT: "" },
    { VITE_ADSENSE_SLOT: "0000000000" },
    { VITE_ADSENSE_CMP_READY: "false" },
  ])
    assert.equal(
      advertisingConfig({ ...configured, ...override }, false).mode,
      "off",
    );
});
test("ads.txt authorizes only the configured valid publisher, never placeholders or injected text", () => {
  assert.equal(
    adsTxt(configured.VITE_ADSENSE_CLIENT),
    "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
  );
  for (const invalid of [
    "",
    "ca-pub-0000000000000000",
    "ca-pub-1234567890123456\nother.com, fake",
  ]) {
    assert.equal(adsTxt(invalid), null);
  }
});
