import { describe, expect, it } from "vitest";
import { buildFeedbackUrl } from "./feedback";

const template =
  "https://docs.google.com/forms/d/e/abc/viewform?usp=pp_url&entry.111=APP_VERSION&entry.222=DEVICE_INFO";

describe("buildFeedbackUrl", () => {
  it("fills in the version and device, URL-encoded", () => {
    const url = buildFeedbackUrl(template, { version: "1.0.0", device: "Google Pixel 8, Android 16" });
    expect(url).toContain("entry.111=1.0.0");
    expect(url).toContain("entry.222=Google%20Pixel%208%2C%20Android%2016");
  });

  it("blanks the fields when the tester opts out", () => {
    const url = buildFeedbackUrl(template, null);
    expect(url).toContain("entry.111=&entry.222=");
    expect(url).not.toContain("APP_VERSION");
  });

  it("leaves links without placeholders unchanged", () => {
    const plain = "https://forms.gle/xyz";
    expect(buildFeedbackUrl(plain, { version: "1.0.0", device: "x" })).toBe(plain);
  });
});
