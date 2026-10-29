import assert from "node:assert/strict";
import { test } from "node:test";
import { requestAd, openAdConsent } from "../src/lib/adsense.ts";

test("AdSense loads once and never requests a slot twice or after its view is removed", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const scripts: Array<{ src: string; onload: () => void }> = [];
  const google = {
    adsbygoogle: [] as object[],
    setTimeout,
    clearTimeout,
    googlefc: undefined as
      | undefined
      | { callbackQueue: Array<() => void>; showRevocationMessage: () => void },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: google,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({}),
      head: {
        appendChild: (script: (typeof scripts)[number]) => {
          scripts.push(script);
          queueMicrotask(() => script.onload());
        },
      },
    },
  });
  try {
    const element = { isConnected: true, dataset: {} } as HTMLElement;
    await Promise.all([
      requestAd(element, "ca-pub-1234567890123456", () => true),
      requestAd(element, "ca-pub-1234567890123456", () => true),
    ]);
    assert.equal(scripts.length, 1);
    assert.equal(
      new URL(scripts[0].src).hostname,
      "pagead2.googlesyndication.com",
    );
    assert.equal(google.adsbygoogle.length, 1);
    await requestAd(element, "ca-pub-1234567890123456", () => true);
    await requestAd(
      { isConnected: false, dataset: {} } as HTMLElement,
      "ca-pub-1234567890123456",
      () => true,
    );
    await requestAd(
      { isConnected: true, dataset: {} } as HTMLElement,
      "ca-pub-1234567890123456",
      () => false,
    );
    assert.equal(google.adsbygoogle.length, 1);
    assert.equal(openAdConsent(), false);
    let revocations = 0;
    google.googlefc = {
      callbackQueue: [],
      showRevocationMessage: () => {
        revocations++;
      },
    };
    assert.equal(openAdConsent(), true);
    google.googlefc.callbackQueue[0]();
    assert.equal(revocations, 1);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
