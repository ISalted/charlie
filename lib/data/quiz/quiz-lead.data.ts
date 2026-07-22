import { faker } from "@faker-js/faker";
import { env } from "@lib/config";

/**
 * A synthetic, tagged lead the quiz will turn into a real account + trial booking.
 * Tagged + unique so runs don't collide and created entities are identifiable on stage.
 * The engine uses it for CONSTRAINED inputs (name, email, phone); choice steps are answered
 * generically by shape, not from the persona.
 */
export interface QuizLead {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export function quizLead(prefix: string): QuizLead {
  const stamp = `${Date.now().toString(36)}${faker.string.alphanumeric(4).toLowerCase()}`;
  return {
    email: `aqa.${prefix}.${stamp}@${env.emailDomain}`,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    // Full E.164 so the intl-tel widget resolves the country and enables the CTA.
    // Ukrainian mobile (+380 50 XXXXXXX); synthetic — never a real subscriber.
    phone: `+38050${faker.string.numeric(7)}`,
  };
}
