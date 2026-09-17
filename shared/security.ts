export const SESSION_DAYS = 7;
export const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
export const token = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string) { return encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
export async function hashPassword(password: string, salt = token()) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: 100000, salt: new TextEncoder().encode(salt) }, key, 256);
  return `${salt}:${encode(new Uint8Array(bits))}`;
}
export async function verifyPassword(password: string, stored: string) {
  const actual = await hashPassword(password, stored.split(":")[0]);
  let different = actual.length ^ stored.length;
  for (let i = 0; i < actual.length; i++) different |= actual.charCodeAt(i) ^ (stored.charCodeAt(i) || 0);
  return different === 0;
}
