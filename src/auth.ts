/**
 * Google Identity Services (GIS) wrapper + result submission.
 *
 * Thin adapter over Google's client-side auth library.
 * The game works fully without this — sign-in only gates the "Submit Results" button.
 */

// ============================================================================
// Configuration
// ============================================================================

const GIS_CLIENT_ID = '294482887266-a801ub2fml6usudbh1qvddf1f576r0jc.apps.googleusercontent.com';
const API_BASE = 'https://adaptive-quiz-back-end-NealAddicott.replit.app';
const SESSION_KEY = 'cf_auth';
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const ALLOWED_DOMAIN = 'dtechhs.org';

// ============================================================================
// Types
// ============================================================================

export interface AuthSession {
  email: string;
  idToken: string;
  timestamp: number;
}

export interface SubmissionPayload {
  id_token: string;
  player_id: string;
  scenario_id: string;
  score: number;
  tier: string;
  years_completed: number;
  final_cash: number;
  completion_code: string;
  curated_seed: number;
  components: {
    financial: number;
    soil: number;
    diversity: number;
    adaptation: number;
    consistency: number;
  };
}

export interface SubmissionResult {
  success: boolean;
  receipt_id?: string;
  email?: string;
  error?: string;
}

// ============================================================================
// GIS Library Loading
// ============================================================================

let gisLoaded = false;
let gisLoadPromise: Promise<void> | null = null;

/** Load the Google Identity Services library from CDN. Returns when ready. */
export function loadGoogleIdentityServices(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded (e.g., via script tag in index.html)
    if (typeof google !== 'undefined' && google.accounts?.id) {
      gisLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

// ============================================================================
// Session Management
// ============================================================================

/** Check for existing valid session in localStorage. */
export function getSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const session: AuthSession = JSON.parse(stored);
    if (Date.now() - session.timestamp > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/** Returns true if a valid (non-expired) session exists. */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

/** Clear the stored session. */
export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
}

function storeSession(email: string, idToken: string): AuthSession {
  const session: AuthSession = { email, idToken, timestamp: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// ============================================================================
// Google Sign-In
// ============================================================================

/**
 * Initialize GIS and render the sign-in button into a container element.
 * Calls onSuccess with the session after successful sign-in.
 * Calls onError if the domain is wrong or something fails.
 */
export async function renderSignInButton(
  container: HTMLElement,
  onSuccess: (session: AuthSession) => void,
  onError?: (message: string) => void,
): Promise<void> {
  try {
    await loadGoogleIdentityServices();
  } catch {
    onError?.('Could not load Google Sign-In. Check your internet connection.');
    return;
  }

  google.accounts.id.initialize({
    client_id: GIS_CLIENT_ID,
    callback: (response: { credential: string }) => {
      try {
        // Decode JWT payload (signature verified by Google's GIS library above)
        const parts = response.credential.split('.');
        if (parts.length !== 3) throw new Error('Malformed JWT');
        const payload = JSON.parse(atob(parts[1]));
        if (!payload || typeof payload !== 'object') throw new Error('Invalid JWT payload');
        const email: string = payload.email;
        if (typeof email !== 'string' || !email.includes('@')) throw new Error('Invalid email in token');

        if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
          onError?.(`Please use your @${ALLOWED_DOMAIN} account.`);
          return;
        }

        const session = storeSession(email, response.credential);
        onSuccess(session);
      } catch {
        onError?.('Sign-in failed. Please try again.');
      }
    },
  });

  google.accounts.id.renderButton(container, {
    type: 'standard',
    size: 'large',
    text: 'signin_with',
    theme: 'outline',
  });
}

// ============================================================================
// Result Submission
// ============================================================================

/** Submit game results to the backend. */
export async function submitGameResult(payload: SubmissionPayload): Promise<SubmissionResult> {
  try {
    const response = await fetch(`${API_BASE}/submit_game_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      return { success: false, error: `Server error (${response.status}): ${text}` };
    }

    const data = await response.json();
    return {
      success: true,
      receipt_id: data.receipt_id,
      email: data.email,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

// ============================================================================
// Google GIS Type Declarations (minimal)
// ============================================================================

declare const google: {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }): void;
      renderButton(
        container: HTMLElement,
        config: { type: string; size: string; text: string; theme: string },
      ): void;
    };
  };
};
