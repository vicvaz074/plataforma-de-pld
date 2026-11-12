/** Shared account policy. Passwords are opaque strings: never trim or normalize them. */
export const PASSWORD_MIN_LENGTH = 11
export const PASSWORD_MAX_LENGTH = 128

export function isValidPasswordLength(value: unknown): value is string {
  return typeof value === "string" && value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH
}
