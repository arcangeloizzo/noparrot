/**
 * NoParrot — Password policy source of truth.
 *
 * Values discovered from the live Supabase Auth `/signup` endpoint on 2026-07-23
 * via controlled probe attempts. Server rejects with `error_code: "weak_password"`
 * and `weak_password.reasons: ["length"|"pwned"]`.
 *
 * Actual policy on this project:
 *   - min length: 6 (server: "Password should be at least 6 characters")
 *   - character classes required: NONE (`Tr0ub4dor&3xyz`, `Abcdefg1`, `abcdefgh`
 *     all pass the strength check; only fail if HIBP flags them)
 *   - HIBP leaked-password check: ENABLED (`reasons: ["pwned"]`)
 *
 * Client mirrors these rules so the UI never lets a user try a password the
 * server will surely reject on `length`, and shows a targeted italian message
 * for `pwned` responses.
 */
export interface PasswordCheck {
  id: string;
  label: string;
  ok: boolean;
}

export const PASSWORD_POLICY = {
  minLength: 6,
  requireLower: false,
  requireUpper: false,
  requireDigit: false,
  requireSymbol: false,
  hibpEnabled: true,
} as const;

export function checkPassword(pw: string): { ok: boolean; checks: PasswordCheck[] } {
  const checks: PasswordCheck[] = [
    {
      id: "length",
      label: `Almeno ${PASSWORD_POLICY.minLength} caratteri`,
      ok: pw.length >= PASSWORD_POLICY.minLength,
    },
  ];
  if (PASSWORD_POLICY.requireLower) {
    checks.push({ id: "lower", label: "Una lettera minuscola", ok: /[a-z]/.test(pw) });
  }
  if (PASSWORD_POLICY.requireUpper) {
    checks.push({ id: "upper", label: "Una lettera maiuscola", ok: /[A-Z]/.test(pw) });
  }
  if (PASSWORD_POLICY.requireDigit) {
    checks.push({ id: "digit", label: "Un numero", ok: /\d/.test(pw) });
  }
  if (PASSWORD_POLICY.requireSymbol) {
    checks.push({
      id: "symbol",
      label: "Un simbolo",
      ok: /[^A-Za-z0-9]/.test(pw),
    });
  }
  if (PASSWORD_POLICY.hibpEnabled) {
    checks.push({
      id: "hibp",
      label: "Non deve essere una password comune o compromessa",
      // Client cannot verify HIBP — always shown as neutral hint. `ok: true`
      // so the composite gate is not blocked; the server rejects with `pwned`
      // and the UI surfaces the italian message.
      ok: true,
    });
  }
  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * Map a Supabase auth error onto an italian, actionable message. Covers the
 * `weak_password` variants observed on this project's `/signup` endpoint.
 */
export function mapPasswordError(error: unknown): string {
  const err = error as {
    message?: string;
    error_code?: string;
    code?: string | number;
    weak_password?: { reasons?: string[] };
  } | null | undefined;
  const reasons = err?.weak_password?.reasons ?? [];
  const msg = (err?.message ?? "").toLowerCase();
  if (
    reasons.includes("pwned") ||
    msg.includes("pwned") ||
    msg.includes("leaked") ||
    msg.includes("breach") ||
    msg.includes("known to be weak")
  ) {
    return "Questa password è apparsa in violazioni di dati note. Scegline un'altra.";
  }
  if (reasons.includes("length") || msg.includes("at least")) {
    return `La password deve essere di almeno ${PASSWORD_POLICY.minLength} caratteri.`;
  }
  return err?.message ?? "Password non valida.";
}