export interface AdEnvironment {
  VITE_ADS_MODE?: string;
  VITE_ADSENSE_CLIENT?: string;
  VITE_ADSENSE_SLOT?: string;
  VITE_ADSENSE_CMP_READY?: string;
}

export function validPublisher(client: string) {
  return /^ca-pub-\d{16}$/.test(client) && !/^ca-pub-0+$/.test(client);
}

export function advertisingConfig(env: AdEnvironment, development: boolean) {
  const client = env.VITE_ADSENSE_CLIENT?.trim() || "";
  const slot = env.VITE_ADSENSE_SLOT?.trim() || "";
  const requested = env.VITE_ADS_MODE || (development ? "preview" : "off");
  const mode =
    requested === "preview"
      ? "preview"
      : requested === "live" &&
          !development &&
          validPublisher(client) &&
          /^\d{10}$/.test(slot) &&
          !/^0+$/.test(slot) &&
          env.VITE_ADSENSE_CMP_READY === "true"
        ? "live"
        : "off";
  return { mode, client, slot } as const;
}

export function adsTxt(client: string) {
  return validPublisher(client)
    ? `google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n`
    : null;
}
