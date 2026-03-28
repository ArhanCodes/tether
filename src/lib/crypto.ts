import * as Crypto from "expo-crypto";

export async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const candidate = await hashPassword(password);
  return candidate === hash;
}
