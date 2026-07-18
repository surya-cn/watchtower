import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const TENANT_SCOPED_MODELS = [
  "RawPost",
  "IssueCluster",
  "StatusHistory",
] as const;

function assertHasProjectId(
  model: string,
  operation: string,
  args: any
): void {
  switch (operation) {
    case "create": {
      if (!args?.data || !("project_id" in args.data)) {
        throw new Error(
          `Multi-tenancy violation: "${operation}" on "${model}" must include project_id in data.`
        );
      }
      break;
    }

    case "createMany":
    case "createManyAndReturn": {
      const records = Array.isArray(args?.data) ? args.data : [args?.data];
      for (let i = 0; i < records.length; i++) {
        if (!records[i] || !("project_id" in records[i])) {
          throw new Error(
            `Multi-tenancy violation: "${operation}" on "${model}" ` +
            `record at index ${i} must include project_id in data.`
          );
        }
      }
      break;
    }

    case "upsert": {
      if (!args?.create || !("project_id" in args.create)) {
        throw new Error(
          `Multi-tenancy violation: "${operation}" on "${model}" ` +
          `must include project_id in create data.`
        );
      }
      break;
    }

    default: {
      if (!args?.where || !("project_id" in args.where)) {
        throw new Error(
          `Multi-tenancy violation: "${operation}" on "${model}" ` +
          `must include project_id in where.`
        );
      }
      break;
    }
  }
}

function createExtendedPrismaClient() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === 'test' ? 2 : 10
  });
  const adapter = new PrismaPg(pool);
  const basePrisma = new PrismaClient({ adapter });

  return basePrisma.$extends({
    query: {
      rawPost: {
        async $allOperations({ model, operation, args, query }) {
          assertHasProjectId(model, operation, args);
          return query(args);
        },
      },
      issueCluster: {
        async $allOperations({ model, operation, args, query }) {
          assertHasProjectId(model, operation, args);
          return query(args);
        },
      },
      statusHistory: {
        async $allOperations({ model, operation, args, query }) {
          assertHasProjectId(model, operation, args);
          return query(args);
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createExtendedPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type ExtendedPrismaClient = typeof prisma;
