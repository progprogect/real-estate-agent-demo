import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma';
import { DEMO_PASSWORD, demoAgents, demoCriteria, demoVisits, visitDatetimeFor } from '../src/lib/demo-data';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const usersByEmail = new Map<string, string>();
  for (const a of demoAgents) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role, branch: a.branch },
      create: {
        email: a.email,
        passwordHash,
        name: a.name,
        role: a.role,
        branch: a.branch,
        zohoUserId: a.zohoUserId,
      },
    });
    usersByEmail.set(a.email, user.id);
  }

  for (const c of demoCriteria) {
    await prisma.criterionConfig.upsert({
      where: { key: c.key },
      update: { label: c.label, hint: c.hint, sortOrder: c.sortOrder },
      create: c,
    });
  }

  const now = new Date();
  for (const v of demoVisits) {
    const agentId = usersByEmail.get(v.agentEmail);
    if (!agentId) continue;
    await prisma.visit.upsert({
      where: { zohoEventId: v.zohoEventId },
      update: {},
      create: {
        zohoEventId: v.zohoEventId,
        zohoDealId: `zd-${v.zohoEventId.slice(3)}`,
        zohoContactId: `zc-${v.zohoEventId.slice(3)}`,
        propertyRef: v.propertyRef,
        address: v.address,
        prospectName: v.prospectName,
        visitDatetime: visitDatetimeFor(v, now),
        status: v.status,
        agentId,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`Agents: ${demoAgents.map((a) => a.email).join(', ')}`);
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
