import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Device } from "@capacitor/device";

export interface FeedbackContext {
  version: string;
  device: string;
}

/** Fills the APP_VERSION and DEVICE_INFO placeholders in a pre-filled Google Form link. */
export function buildFeedbackUrl(template: string, context: FeedbackContext | null): string {
  return template
    .replace(/APP_VERSION/g, encodeURIComponent(context?.version ?? ""))
    .replace(/DEVICE_INFO/g, encodeURIComponent(context?.device ?? ""));
}

export async function feedbackContext(): Promise<FeedbackContext> {
  let device = "Unknown device";
  try {
    const info = await Device.getInfo();
    const os = info.operatingSystem === "android" ? "Android" : info.operatingSystem;
    device = Capacitor.isNativePlatform()
      ? `${info.manufacturer} ${info.model}, ${os} ${info.osVersion}`
      : `Web browser (${info.osVersion ? `${os} ${info.osVersion}` : os})`;
  } catch {
    // Device info is a nice-to-have for bug reports; send without it.
  }
  return { version: __APP_VERSION__, device };
}

/** Opens a link in an in-app browser tab on Android, or a new tab on the web. */
export async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener");
}
