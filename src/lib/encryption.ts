"server only";

const CREDENTIAL_FIELDS = new Set([
  "cloudadmin_password",
  "imanadmin_email",
  "imanadmin_password",
]);

export function isCredentialField(key: string): boolean {
  return CREDENTIAL_FIELDS.has(key);
}

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY env var is not set");
  return Buffer.from(hex, "hex");
}

export async function encrypt(plaintext: string): Promise<string> {
  const { createCipheriv, randomBytes } = await import("crypto");
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Format: iv(12):tag(16):ciphertext — all hex
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export async function decrypt(ciphertext: string): Promise<string> {
  const { createDecipheriv } = await import("crypto");
  const key = getKey();
  const [ivHex, tagHex, dataHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}
