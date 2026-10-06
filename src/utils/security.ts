/**
 * AMBAR AKUNTAN - Security & Banking-Grade Cryptography Module
 * Uses standard Web Crypto API (AES-GCM 256-bit, SHA-256)
 */

const VAULT_SALT = 'AMBAR_AKUNTAN_SECURE_SALT_V1';
const VAULT_KEY_STORAGE = 'ambar_vault_session_key';

// Calculate SHA-256 hash of an ArrayBuffer or File
export async function calculateFileHash(buffer: ArrayBuffer): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('Hash calculation failed:', err);
    return 'sha256-fallback-' + Date.now();
  }
}

// Derive AES-GCM 256-bit key from passphrase
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(VAULT_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Get or initialize persistent session key
export function getOrCreateSessionPassphrase(): string {
  let key = sessionStorage.getItem(VAULT_KEY_STORAGE);
  if (!key) {
    // Generate secure random string
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(VAULT_KEY_STORAGE, key);
  }
  return key;
}

// Encrypt JSON object to ciphertext
export async function encryptData(data: any, customPassphrase?: string): Promise<string> {
  try {
    const passphrase = customPassphrase || getOrCreateSessionPassphrase();
    const key = await deriveKey(passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encoded = enc.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoded
    );

    // Combine IV + ciphertext as Base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binary = '';
    const bytes = combined;
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error('Encryption failed:', err);
    throw new Error('Gagal mengenkripsi data finansial.');
  }
}

// Decrypt ciphertext to original JSON object
export async function decryptData(encryptedBase64: string, customPassphrase?: string): Promise<any> {
  try {
    const passphrase = customPassphrase || getOrCreateSessionPassphrase();
    const key = await deriveKey(passphrase);

    const binary = atob(encryptedBase64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Gagal mendekripsi data: kata sandi tidak cocok atau data rusak.');
  }
}

// Masking utilities
export function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return acc;
  return acc.substring(0, 3) + '****' + acc.substring(acc.length - 3);
}

export function maskName(name: string): string {
  if (!name) return '';
  const parts = name.split(' ');
  return parts.map((p, idx) => (idx === 0 ? p : p[0] + '***')).join(' ');
}
