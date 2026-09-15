// src/utils/passwordGenerator.ts
//
// Shared by the single "Add Employee" modal and the bulk CSV importer —
// extracted so both use the exact same temporary-password shape instead of
// two copies drifting apart.

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 10 chars, drawn from an alphabet that skips visually-ambiguous
 * characters (no I/O/0/1/l) so a temporary password is easy to read back
 * off a screen or printout. */
export function generateTemporaryPassword(): string {
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}
