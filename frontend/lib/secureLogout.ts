const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000";

export type SecureLogoutResult =
    | {
          shouldClearLocalSession: true;
          kind: "no_token" | "server_revoked" | "session_invalid";
          status: number | null;
      }
    | {
          shouldClearLocalSession: false;
          kind: "unconfirmed";
          status: number | null;
      };

export const secureLogout = async (
    rawToken: string
): Promise<SecureLogoutResult> => {
    const token = rawToken.trim();

    /*
     * With no local bearer credential there is no server-side
     * session credential available for this client to revoke.
     * Local cleanup is therefore safe.
     */
    if (!token) {
        return {
            shouldClearLocalSession: true,
            kind: "no_token",
            status: null,
        };
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/logout`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            }
        );

        /*
         * A successful response proves the authenticated session
         * was either revoked or was already superseded during the
         * narrow protect -> controller race.
         */
        if (response.ok) {
            return {
                shouldClearLocalSession: true,
                kind: "server_revoked",
                status: response.status,
            };
        }

        /*
         * 401 is authoritative for this bearer credential:
         * it is expired, invalid or no longer the active session.
         * Keeping it locally provides no recoverable session.
         */
        if (response.status === 401) {
            return {
                shouldClearLocalSession: true,
                kind: "session_invalid",
                status: response.status,
            };
        }

        /*
         * For every other HTTP failure we cannot prove that the
         * active server-side session was revoked. Keep local auth
         * state so the UI never falsely claims a secure logout.
         */
        return {
            shouldClearLocalSession: false,
            kind: "unconfirmed",
            status: response.status,
        };
    } catch {
        /*
         * Network/provider/browser failure is not evidence that
         * the server-side session was revoked.
         */
        return {
            shouldClearLocalSession: false,
            kind: "unconfirmed",
            status: null,
        };
    }
};