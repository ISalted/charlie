import * as dotenv from "dotenv";

dotenv.config();

/**
 * Single source of environment config. Same code, different secrets (local .env / CI GitHub Secrets)
 * to switch environments. Never hardcode creds — see .env.example.
 */
export const env = {
  baseUrl: process.env.BASE_URL ?? "https://stage.allright.com",
  apiUrl: process.env.API_URL ?? "",
  apiToken: process.env.API_TOKEN ?? "",
  emailDomain: process.env.QUIZ_EMAIL_DOMAIN ?? "aqa.example.com",
} as const;
