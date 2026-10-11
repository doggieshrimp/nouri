import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  BarcodeFormat,
  BarcodeScanner,
  GoogleBarcodeScannerModuleInstallState as InstallState,
} from "@capacitor-mlkit/barcode-scanning";
import { expandUpcE } from "./openFoodFacts";

/** Camera scanning uses Google's code scanner, so it only exists in the Android app. */
export const canScan = Capacitor.isNativePlatform();

/** Google's scanner UI ships as a Play services module that may need a one-time download. */
async function ensureScannerModule(onStatus?: (message: string) => void): Promise<void> {
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) return;

  onStatus?.("Downloading the barcode scanner (one time only)…");
  let handle: PluginListenerHandle | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      BarcodeScanner.addListener("googleBarcodeScannerModuleInstallProgress", (event) => {
        if (event.state === InstallState.COMPLETED) resolve();
        else if (event.state === InstallState.FAILED || event.state === InstallState.CANCELED) {
          reject(new Error("Couldn't download the barcode scanner. Check your internet connection."));
        }
      })
        .then((h) => {
          handle = h;
          return BarcodeScanner.installGoogleBarcodeScannerModule();
        })
        .catch(reject);
    });
  } finally {
    await handle?.remove();
  }
}

/** Opens the camera scanner. Returns the barcode, or null if the person backed out. */
export async function scanBarcode(onStatus?: (message: string) => void): Promise<string | null> {
  await ensureScannerModule(onStatus);
  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
      autoZoom: true,
    });
    const barcode = barcodes[0];
    if (!barcode?.rawValue) return null;
    return barcode.format === BarcodeFormat.UpcE ? expandUpcE(barcode.rawValue) : barcode.rawValue;
  } catch (err) {
    if ((err as Error).message?.toLowerCase().includes("cancel")) return null;
    throw err;
  }
}
