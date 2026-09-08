import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo1234';

const criteria = [
  {
    key: 'buying_readiness',
    label: 'Ready to buy',
    hint: 'Is the prospect ready to buy?',
    sortOrder: 1,
  },
  {
    key: 'visit_appreciation',
    label: 'Enjoyed the viewing',
    hint: 'Did they enjoy the viewing?',
    sortOrder: 2,
  },
  {
    key: 'price_perception',
    label: 'Price perception',
    hint: 'How did they react to the asking price?',
    sortOrder: 3,
  },
  {
    key: 'objections_concerns',
    label: 'Objections and concerns',
    hint: 'Any objections or concerns raised?',
    sortOrder: 4,
  },
];

type VisitSeed = {
  zohoEventId: string;
  propertyRef: string;
  address: string;
  prospectName: string;
  hoursAgo: number; // negative = in the future
  status: 'PENDING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';
};

const visitsAgent1: VisitSeed[] = [
  { zohoEventId: 'ze-1001', propertyRef: 'BE-1180-4412', address: 'Avenue Brugmann 112, Uccle', prospectName: 'Claire Dumont', hoursAgo: 3, status: 'PENDING' },
  { zohoEventId: 'ze-1002', propertyRef: 'BE-1050-2201', address: 'Rue du Bailli 27, Ixelles', prospectName: 'Thomas Peeters', hoursAgo: 7, status: 'PENDING' },
  { zohoEventId: 'ze-1003', propertyRef: 'BE-1000-0871', address: 'Quai aux Briques 54, Brussels', prospectName: 'Sofia Mancini', hoursAgo: 26, status: 'PENDING' },
  { zohoEventId: 'ze-1004', propertyRef: 'BE-1180-3358', address: 'Rue Vanderkindere 210, Uccle', prospectName: 'Jan Willems', hoursAgo: 49, status: 'ANSWERED' },
  { zohoEventId: 'ze-1005', propertyRef: 'BE-1060-1104', address: 'Chaussee de Waterloo 341, Saint-Gilles', prospectName: 'Amelie Rousseau', hoursAgo: 74, status: 'ANSWERED' },
  { zohoEventId: 'ze-1006', propertyRef: 'BE-1050-2544', address: 'Avenue Louise 480, Ixelles', prospectName: 'David Vermeulen', hoursAgo: 170, status: 'EXPIRED' },
  { zohoEventId: 'ze-1007', propertyRef: 'BE-1000-0912', address: 'Rue Antoine Dansaert 95, Brussels', prospectName: 'Louise Martin', hoursAgo: 30, status: 'CANCELLED' },
];

const visitsAgent2: VisitSeed[] = [
  { zohoEventId: 'ze-2001', propertyRef: 'BE-1200-7731', address: 'Avenue de Broqueville 40, Woluwe', prospectName: 'Pieter Janssens', hoursAgo: 5, status: 'PENDING' },
  { zohoEventId: 'ze-2002', propertyRef: 'BE-1150-6620', address: 'Rue au Bois 133, Woluwe-Saint-Pierre', prospectName: 'Emma Lefevre', hoursAgo: 28, status: 'PENDING' },
  { zohoEventId: 'ze-2003', propertyRef: 'BE-1030-5017', address: 'Avenue Louis Bertrand 22, Schaerbeek', prospectName: 'Marc Dubois', hoursAgo: 52, status: 'ANSWERED' },
  { zohoEventId: 'ze-2004', propertyRef: 'BE-1040-4209', address: 'Rue des Tongres 8, Etterbeek', prospectName: 'Nina Van Damme', hoursAgo: 190, status: 'EXPIRED' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [agent1, agent2] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'marie.laurent@demo.agency' },
      update: {},
      create: {
        email: 'marie.laurent@demo.agency',
        passwordHash,
        name: 'Marie Laurent',
        role: 'AGENT',
        branch: 'Uccle',
        zohoUserId: 'zu-501',
      },
    }),
    prisma.user.upsert({
      where: { email: 'koen.devos@demo.agency' },
      update: {},
      create: {
        email: 'koen.devos@demo.agency',
        passwordHash,
        name: 'Koen De Vos',
        role: 'AGENT',
        branch: 'Woluwe',
        zohoUserId: 'zu-502',
      },
    }),
    prisma.user.upsert({
      where: { email: 'admin@demo.agency' },
      update: {},
      create: {
        email: 'admin@demo.agency',
        passwordHash,
        name: 'Alex Moreau',
        role: 'ADMIN',
        branch: 'HQ',
      },
    }),
  ]);

  for (const c of criteria) {
    await prisma.criterionConfig.upsert({
      where: { key: c.key },
      update: { label: c.label, hint: c.hint, sortOrder: c.sortOrder },
      create: c,
    });
  }

  const now = Date.now();
  const seedVisits = async (agentId: string, list: VisitSeed[]) => {
    for (const v of list) {
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
          visitDatetime: new Date(now - v.hoursAgo * 3600_000),
          status: v.status,
          agentId,
        },
      });
    }
  };

  await seedVisits(agent1.id, visitsAgent1);
  await seedVisits(agent2.id, visitsAgent2);

  console.log('Seed complete.');
  console.log(`Agents: marie.laurent@demo.agency / koen.devos@demo.agency`);
  console.log(`Admin:  admin@demo.agency`);
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
