// Public app settings. Both values are visible to users, so no secrets here.
// `npm run aab` refuses to build a release while either still has its placeholder.

/** Contact address shown in the privacy policy (public/privacy.html uses the same one). */
export const CONTACT_EMAIL = "johngoblinsupport@gmail.com";

/**
 * Google Form for tester feedback, as a pre-filled link.
 * In the form: ⋮ menu > Get pre-filled link > type APP_VERSION and DEVICE_INFO into the
 * fields for version and device > Get link > Copy link, and paste it here.
 * The app swaps those two words for the real values (or blanks if the tester opts out).
 * Leave empty to hide the feedback button.
 */
export const FEEDBACK_FORM_URL = "";
