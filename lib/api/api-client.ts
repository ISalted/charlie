import type { APIRequestContext } from "@playwright/test";
import { env } from "@lib/config";
import { step } from "@helpers/step";

/**
 * The OUTCOME ORACLE (crown jewel). Verifies the variant-independent business result —
 * account created + trial booked — via the backend. This is the most stable signal and does
 * NOT depend on which screens the quiz showed.
 *
 * SCAFFOLD: the endpoints below are placeholders. Request the real stage API contract + creds
 * from the Charlie team, then finalize in /sdk-builder (Path B). Until API_URL is configured,
 * tests should use the network-intercept oracle (helpers.waitForOkResponse) instead.
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /** True if an account exists for the lead's email. */
  @step()
  async userExists(email: string): Promise<boolean> {
    this.assertConfigured();
    // TODO(charlie-team): confirm the real "find user" endpoint + query shape.
    const res = await this.request.get(`${env.apiUrl}/users`, {
      params: { email },
      headers: this.authHeaders(),
    });
    if (!res.ok()) return false;
    const body = (await res.json()) as { items?: unknown[] };
    return Array.isArray(body.items) && body.items.length > 0;
  }

  /** True if a trial lesson is booked for the lead's email. */
  @step()
  async trialBookedFor(email: string): Promise<boolean> {
    this.assertConfigured();
    // TODO(charlie-team): confirm the real "bookings by user" endpoint + trial flag.
    const res = await this.request.get(`${env.apiUrl}/bookings`, {
      params: { email, type: "trial" },
      headers: this.authHeaders(),
    });
    if (!res.ok()) return false;
    const body = (await res.json()) as { items?: unknown[] };
    return Array.isArray(body.items) && body.items.length > 0;
  }

  private authHeaders(): Record<string, string> {
    return env.apiToken ? { Authorization: `Bearer ${env.apiToken}` } : {};
  }

  private assertConfigured(): void {
    if (!env.apiUrl) {
      throw new Error(
        "API_URL is not set — the API oracle is unavailable. Set it (see .env.example) or use " +
          "the network-intercept oracle (helpers.waitForOkResponse) instead.",
      );
    }
  }
}
