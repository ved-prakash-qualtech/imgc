import CryptoJS from "crypto-js";

/**
 * AES-256-CBC utility (docs/standards/encryption.md).
 *
 * - Algorithm : AES-256 in CBC mode with PKCS#7 padding
 * - IV        : 16 random bytes generated per encryption call
 * - Wire format: `${ivHex}:${ciphertextBase64}`  (`:` is safe — not in base64)
 *
 * This module has NO server-only constraint; it may be imported by both
 * server code (via tenantEncryption.ts) and client-side form helpers.
 * Keys must never be passed to client components — that boundary is enforced
 * by tenantEncryption.ts (server-only).
 */

const IV_BYTES = 16;
const SEPARATOR = ":";

/**
 * Encrypt plaintext with AES-256-CBC.
 * @param plaintext  UTF-8 string
 * @param keyHex     64 hex chars (32 bytes = 256-bit key)
 * @returns          `${ivHex}:${ciphertextBase64}`
 */
export function aesEncrypt(plaintext: string, keyHex: string): string {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.lib.WordArray.random(IV_BYTES);

  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return `${iv.toString(CryptoJS.enc.Hex)}${SEPARATOR}${encrypted.toString()}`;
}

/**
 * Decrypt an AES-256-CBC ciphertext produced by `aesEncrypt`.
 * @param ciphertext  `${ivHex}:${ciphertextBase64}`
 * @param keyHex      64 hex chars (32 bytes = 256-bit key)
 * @returns           Decrypted UTF-8 string
 * @throws            If the format is invalid or the key is wrong
 */
export function aesDecrypt(ciphertext: string, keyHex: string): string {
  const sep = ciphertext.indexOf(SEPARATOR);
  if (sep === -1) throw new Error("[aes] Invalid ciphertext: missing IV separator");

  const ivHex = ciphertext.slice(0, sep);
  const encryptedData = ciphertext.slice(sep + 1);

  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plaintext) throw new Error("[aes] Decryption failed — wrong key or corrupted ciphertext");
  return plaintext;
}
