import { prisma } from "./src/lib/prisma.ts";

async function main() {
  const posts = await prisma.$queryRaw`SELECT * FROM raw_posts WHERE content LIKE '%why crashed game%'`;
  console.log(JSON.stringify(posts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
