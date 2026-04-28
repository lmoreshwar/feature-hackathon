import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = 'enc:v1:';

const getKey = (): Buffer => {
  const secret =
    process.env.ENCRYPTION_KEY ?? 'dev-encryption-key-change-me-please';
  return createHash('sha256').update(secret).digest();
};

export const isEncrypted = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);

export const encryptSecret = (plaintext: string): string => {
  if (!plaintext) {
    return '';
  }
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    ENCRYPTED_PREFIX +
    Buffer.concat([iv, authTag, encrypted]).toString('base64')
  );
};

export const decryptSecret = (payload: string): string => {
  if (!payload) {
    return '';
  }
  if (!isEncrypted(payload)) {
    return payload;
  }

  const raw = Buffer.from(payload.slice(ENCRYPTED_PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
};

export const maskSecret = (value: string | undefined | null): string => {
  if (!value) {
    return '';
  }
  if (value.length <= 4) {
    return '****';
  }
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};
