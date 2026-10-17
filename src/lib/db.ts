import { PrismaClient } from '@prisma/client';

/**
 * App-local re-export point for the Prisma client (docs: import `db` from `@/lib/db`, never
 * Imported lazily, and only when DATA_SOURCE=prisma.
 */
const globalForPrisma = globalThis as unknown as { __finovaPrisma?: PrismaClient };
let prismaClient: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  if (prismaClient ?? globalForPrisma.__finovaPrisma) return (prismaClient ?? globalForPrisma.__finovaPrisma)!;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when DATA_SOURCE=prisma');
  }
  const client = new PrismaClient();
  prismaClient = client;
  if (process.env.NODE_ENV !== 'production') globalForPrisma.__finovaPrisma = client;
  return client;
}

// Several API modules import `db` at module scope, including in mock mode. Defer
// client creation until a Prisma property is actually used so a mock-only install
// can build and run without DATABASE_URL.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
