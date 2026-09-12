/**
 * Polish wording for the errors Supabase Auth returns.
 *
 * Supabase reports failures in English, and those strings surface directly on
 * the sign-in and sign-up screens. Mapping the ones a learner can actually
 * trigger keeps the interface in one language; anything unmapped falls through
 * unchanged rather than being swallowed, so an unexpected failure stays
 * diagnosable.
 */
const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "Nieprawidłowy adres e-mail lub hasło."],
  [/user already registered|already been registered/i, "Konto z tym adresem e-mail już istnieje. Zaloguj się."],
  [/password should be at least (\d+) characters/i, "Hasło musi mieć co najmniej $1 znaków."],
  [/unable to validate email address/i, "Nieprawidłowy format adresu e-mail."],
  [/email rate limit exceeded|over_email_send_rate_limit/i, "Zbyt wiele prób. Spróbuj ponownie za chwilę."],
  [/email not confirmed/i, "Adres e-mail nie został potwierdzony."],
  [/anonymous sign-ins are disabled/i, "Podaj adres e-mail i hasło."],
];

export function translateAuthError(message: string): string {
  for (const [pattern, replacement] of MESSAGES) {
    if (pattern.test(message)) {
      return message.replace(pattern, replacement);
    }
  }
  return message;
}
