import { useState, useEffect, useCallback } from "react";

/**
 * Determines whether the Paste button should be enabled.
 *
 * Returns `true` when the **system clipboard** contains file paths (CF_HDROP).
 * This covers both:
 * - Files copied inside the app (we write to system clipboard via SetFileDropList)
 * - Files copied in Windows Explorer or any other app
 *
 * The check runs on mount, on window focus, and whenever the app copies/cuts
 * files (via the custom `app-clipboard-changed` event).
 */
export function useCanPaste(): boolean {
  const [canPaste, setCanPaste] = useState(false);

  const checkClipboard = useCallback(async () => {
    try {
      const result = await window.api?.hasClipboardFiles?.();
      setCanPaste(result?.ok === true && result.hasFiles === true);
    } catch {
      setCanPaste(false);
    }
  }, []);

  useEffect(() => {
    // Check immediately on mount
    checkClipboard();

    // Re-check when the window regains focus (user might have copied files
    // in Windows Explorer while this app was in the background)
    const onFocus = () => {
      checkClipboard();
    };

    // Re-check when the app itself writes to the clipboard (copy/cut)
    const onAppClipboardChanged = () => {
      checkClipboard();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("app-clipboard-changed", onAppClipboardChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("app-clipboard-changed", onAppClipboardChanged);
    };
  }, [checkClipboard]);

  return canPaste;
}
