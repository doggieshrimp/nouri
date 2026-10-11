import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { FEEDBACK_FORM_URL } from "../config";
import { buildFeedbackUrl, feedbackContext, openExternal } from "../lib/feedback";
import { ALERT, GOLD, INK, PAPER, RULE } from "../theme";

/** Tester feedback and the privacy policy link, at the bottom of the page. */
export default function AboutFooter() {
  const [includeDetails, setIncludeDetails] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function sendFeedback() {
    setError(null);
    try {
      const context = includeDetails ? await feedbackContext() : null;
      await openExternal(buildFeedbackUrl(FEEDBACK_FORM_URL, context));
    } catch {
      setError("Couldn't open the feedback form. Check your internet connection.");
    }
  }

  return (
    <div className="mt-8 pt-3 text-xs" style={{ borderTop: `1px solid ${RULE}` }}>
      {FEEDBACK_FORM_URL ? (
        <div className="mb-4">
          <div className="font-bold uppercase tracking-wide mb-1" style={{ color: GOLD }}>
            Early version
          </div>
          <p className="opacity-70 mb-2">
            Thanks for testing Daily Log. Tell me what&rsquo;s confusing, broken or missing. It only takes a minute.
          </p>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
              className="w-4 h-4 accent-current"
            />
            <span className="opacity-70">Include app version and phone model (helps with bugs)</span>
          </label>
          <button
            type="button"
            onClick={sendFeedback}
            className="w-full flex items-center justify-center gap-2 py-2 font-bold uppercase tracking-wide text-sm"
            style={{ background: INK, color: PAPER }}
          >
            <MessageSquare size={16} /> Send feedback
          </button>
          {error && (
            <div role="alert" className="mt-2" style={{ color: ALERT }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        import.meta.env.DEV && (
          <p className="mb-4 opacity-70">Feedback button hidden: set FEEDBACK_FORM_URL in src/config.ts.</p>
        )
      )}

      <div className="flex items-center gap-3 opacity-70 pb-6">
        <a href="./privacy.html" className="underline">
          Privacy policy
        </a>
        <span aria-hidden>·</span>
        <span>Version {__APP_VERSION__}</span>
      </div>
    </div>
  );
}
