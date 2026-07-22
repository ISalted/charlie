import type { APIRequestContext } from "@playwright/test";
import { env } from "@lib/config";
import { step } from "@helpers/step";

/**
 * The API OUTCOME ORACLE — the variant-independent business check (account created + trial booked)
 * against stage's real endpoints (discovered live): account = `POST /api/v1/users`, trial =
 * `POST /api/v1/lessons`; read-back below.
 *
 * SECONDARY to the network-intercept oracle (`helpers.captureQuizOutcome`): a fresh request context
 * does NOT share the quiz's browser session, so these authenticated GET read-backs need a stage API
 * token (`API_TOKEN`, see .env.example) — request it from the Charlie team. Until then, tests assert
 * the outcome via the network oracle. Endpoints/filter shapes are best-effort; confirm with the team.
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /** True if an account exists for the lead's email (authenticated admin/API-token lookup). */
  @step()
  async userExists(email: string): Promise<boolean> {
    return (await this.findUserId(email)) !== null;
  }

  /** True if a trial lesson is booked for the lead (looked up by the created user's id). */
  @step()
  async trialBookedFor(email: string): Promise<boolean> {
    const userId = await this.findUserId(email);
    if (userId === null) return false;
    const res = await this.request.get(`${env.apiUrl}/api/v1/lessons`, {
      params: { "filter[student_id]": userId },
      headers: this.authHeaders(),
    });
    if (!res.ok()) return false;
    const body = (await res.json()) as { data?: unknown[] };
    return Array.isArray(body.data) && body.data.length > 0;
  }

  /** Resolve the created user's id by email, or null if not found. */
  private async findUserId(email: string): Promise<string | null> {
    this.assertConfigured();
    const res = await this.request.get(`${env.apiUrl}/api/v1/users`, {
      params: { "filter[email]": email },
      headers: this.authHeaders(),
    });
    if (!res.ok()) return null;
    const body = (await res.json()) as { data?: Array<{ id?: string | number }> };
    const id = body.data?.[0]?.id;
    return id === undefined ? null : String(id);
  }

  private authHeaders(): Record<string, string> {
    return env.apiToken ? { Authorization: `Bearer ${env.apiToken}` } : {};
  }

  private assertConfigured(): void {
    if (!env.apiUrl) {
      throw new Error(
        "API_URL is not set — the API oracle is unavailable. Set it + API_TOKEN (see .env.example), " +
          "or use the network-intercept oracle (helpers.captureQuizOutcome) instead.",
      );
    }
  }
}
