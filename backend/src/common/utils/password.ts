import { hash, verify } from '@node-rs/argon2';

// Argon2id (the library default algorithm) with OWASP-recommended parameters.
const options = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, options);

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Pre-computed hash used to keep login timing constant when the account does not exist. */
let dummyHash: Promise<string> | undefined;
export const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing-equalisation'));
