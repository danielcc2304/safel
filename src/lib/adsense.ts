type GoogleAds = Array<Record<string, unknown>>;
type GoogleConsent = {
  callbackQueue: Array<() => void>;
  showRevocationMessage?: () => void;
};
declare global {
  interface Window {
    adsbygoogle?: GoogleAds;
    googlefc?: GoogleConsent;
  }
}

let scriptReady: Promise<void> | undefined;
const requestedSlots = new WeakSet<HTMLElement>();

function loadAdSense(client: string) {
  if (scriptReady) return scriptReady;
  scriptReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "safel-adsense";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    const timeout = window.setTimeout(
      () => reject(new Error("AdSense timeout")),
      12000,
    );
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("AdSense unavailable"));
    };
    document.head.appendChild(script);
  });
  return scriptReady;
}

export async function requestAd(
  element: HTMLElement,
  client: string,
  active: () => boolean,
) {
  await loadAdSense(client);
  // StrictMode, network polling and navigation must never inflate requests.
  if (
    !active() ||
    !element.isConnected ||
    requestedSlots.has(element) ||
    element.dataset.adsbygoogleStatus
  )
    return;
  requestedSlots.add(element);
  (window.adsbygoogle ||= []).push({});
}

export function openAdConsent() {
  const consent = window.googlefc;
  if (!consent?.showRevocationMessage) return false;
  consent.callbackQueue.push(() => consent.showRevocationMessage?.());
  return true;
}
