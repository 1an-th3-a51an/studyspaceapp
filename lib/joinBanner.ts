/**
 * The "you're in" banner that drops over the top sixth of the page.
 *
 * Joining a pool often navigates (Rooms -> Pools), which would unmount a
 * component-local banner mid-animation. So an announcement is written to
 * sessionStorage first and dispatched second: whichever render happens next
 * picks it up, on whatever page the user lands on.
 */

export const JOIN_BANNER_EVENT = "studyspace:join-banner";

/** How long the banner stays on screen. */
export const JOIN_BANNER_MS = 2000;

/** A handoff older than this was a previous session, not this click. */
const HANDOFF_TTL_MS = 8000;

const HANDOFF_KEY = "studyspace.joinBanner";

export type JoinBannerPayload = {
  /** Headline, e.g. "You're in a study pool". */
  title: string;
  /** One line of specifics, e.g. "S&DS 2380 · 2 of 3 · Bass L30A". */
  detail?: string;
  /** Epoch ms, used to ignore stale handoffs. */
  at: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function announceJoin(input: { title: string; detail?: string }) {
  if (!canUseStorage()) return;
  const payload: JoinBannerPayload = { ...input, at: Date.now() };
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    // Private-mode storage failure still leaves the same-page dispatch below.
  }
  window.dispatchEvent(new CustomEvent(JOIN_BANNER_EVENT, { detail: payload }));
}

/** Read and clear a pending announcement left by the previous page. */
export function takePendingJoin(): JoinBannerPayload | null {
  if (!canUseStorage()) return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as JoinBannerPayload;
    if (!parsed?.title || Date.now() - parsed.at > HANDOFF_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingJoin() {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* nothing to clear */
  }
}
