const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.rawPost.findMany({
    where: { content: { contains: "why crashed game" } }
  });
  console.log(JSON.stringify(posts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
