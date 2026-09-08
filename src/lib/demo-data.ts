/**
 * The demo dataset, shared by the database seed and the admin "reset demo data"
 * action. Visit times are expressed as offsets from "now" so every reset produces
 * a list that looks freshly synced from the calendar.
 */

export const DEMO_PASSWORD = 'demo1234';

export const demoCriteria = [
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

export const demoAgents = [
  {
    email: 'marie.laurent@demo.agency',
    name: 'Marie Laurent',
    role: 'AGENT' as const,
    branch: 'Uccle',
    zohoUserId: 'zu-501',
  },
  {
    email: 'koen.devos@demo.agency',
    name: 'Koen De Vos',
    role: 'AGENT' as const,
    branch: 'Woluwe',
    zohoUserId: 'zu-502',
  },
  {
    email: 'admin@demo.agency',
    name: 'Alex Moreau',
    role: 'ADMIN' as const,
    branch: 'HQ',
    zohoUserId: null,
  },
];

export type DemoVisit = {
  zohoEventId: string;
  agentEmail: string;
  propertyRef: string;
  address: string;
  prospectName: string;
  /** Hours before "now" the viewing took place. */
  hoursAgo: number;
  status: 'PENDING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';
};

export const demoVisits: DemoVisit[] = [
  // Marie Laurent — Uccle
  { zohoEventId: 'ze-1001', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1180-4412', address: 'Avenue Brugmann 112, Uccle', prospectName: 'Claire Dumont', hoursAgo: 2, status: 'PENDING' },
  { zohoEventId: 'ze-1002', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1050-2201', address: 'Rue du Bailli 27, Ixelles', prospectName: 'Thomas Peeters', hoursAgo: 5, status: 'PENDING' },
  { zohoEventId: 'ze-1003', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1000-0871', address: 'Quai aux Briques 54, Brussels', prospectName: 'Sofia Mancini', hoursAgo: 8, status: 'PENDING' },
  { zohoEventId: 'ze-1004', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1180-3358', address: 'Rue Vanderkindere 210, Uccle', prospectName: 'Jan Willems', hoursAgo: 26, status: 'PENDING' },
  { zohoEventId: 'ze-1005', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1060-1104', address: 'Chaussee de Waterloo 341, Saint-Gilles', prospectName: 'Amelie Rousseau', hoursAgo: 30, status: 'PENDING' },
  { zohoEventId: 'ze-1006', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1170-8890', address: 'Avenue Franklin Roosevelt 78, Ixelles', prospectName: 'Bruno Casteels', hoursAgo: 33, status: 'PENDING' },
  { zohoEventId: 'ze-1007', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1190-2277', address: 'Rue de Neerpede 15, Forest', prospectName: 'Ines Delvaux', hoursAgo: 50, status: 'ANSWERED' },
  { zohoEventId: 'ze-1008', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1050-9931', address: 'Place Flagey 8, Ixelles', prospectName: 'Hugo Serrano', hoursAgo: 74, status: 'ANSWERED' },
  { zohoEventId: 'ze-1009', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1050-2544', address: 'Avenue Louise 480, Ixelles', prospectName: 'David Vermeulen', hoursAgo: 170, status: 'EXPIRED' },
  { zohoEventId: 'ze-1010', agentEmail: 'marie.laurent@demo.agency', propertyRef: 'BE-1000-0912', address: 'Rue Antoine Dansaert 95, Brussels', prospectName: 'Louise Martin', hoursAgo: 30, status: 'CANCELLED' },

  // Koen De Vos — Woluwe
  { zohoEventId: 'ze-2001', agentEmail: 'koen.devos@demo.agency', propertyRef: 'BE-1200-7731', address: 'Avenue de Broqueville 40, Woluwe', prospectName: 'Pieter Janssens', hoursAgo: 3, status: 'PENDING' },
  { zohoEventId: 'ze-2002', agentEmail: 'koen.devos@demo.agency', propertyRef: 'BE-1150-6620', address: 'Rue au Bois 133, Woluwe-Saint-Pierre', prospectName: 'Emma Lefevre', hoursAgo: 7, status: 'PENDING' },
  { zohoEventId: 'ze-2003', agentEmail: 'koen.devos@demo.agency', propertyRef: 'BE-1200-4408', address: 'Avenue Georges Henri 220, Woluwe', prospectName: 'Sarah Bekaert', hoursAgo: 28, status: 'PENDING' },
  { zohoEventId: 'ze-2004', agentEmail: 'koen.devos@demo.agency', propertyRef: 'BE-1150-1192', address: 'Val des Seigneurs 62, Woluwe-Saint-Pierre', prospectName: 'Olivier Grandjean', hoursAgo: 31, status: 'PENDING' },
  { zohoEventId: 'ze-2005', agentEmail: 'koen.devos@demo.agency', propertyRef: 'BE-1030-5017', address: 'Avenue Louis Bertrand 22, Schaerbeek', prospectName: 'Marc Dubois', hoursAgo: 52, status: 'ANSWERED' },
  { zohoEventId: 'ze-2006', agentEmail: 'koen.devos@demo.agency', propertyRef: 'BE-1040-4209', address: 'Rue des Tongres 8, Etterbeek', prospectName: 'Nina Van Damme', hoursAgo: 190, status: 'EXPIRED' },
];

export function visitDatetimeFor(visit: DemoVisit, now = new Date()): Date {
  return new Date(now.getTime() - visit.hoursAgo * 3600_000);
}
