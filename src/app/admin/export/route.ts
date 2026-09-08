import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const session = await getSession();
  if (!session.userId || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.auditLog.create({
    data: { userId: session.userId, action: 'admin.export_csv', detail: 'Exported viewings CSV' },
  });

  const visits = await prisma.visit.findMany({
    orderBy: { visitDatetime: 'desc' },
    include: {
      agent: { select: { name: true, email: true, branch: true } },
      submission: { select: { status: true, submittedAt: true } },
    },
  });

  const header = [
    'visit_datetime',
    'property_ref',
    'address',
    'prospect',
    'agent',
    'agent_email',
    'branch',
    'status',
    'submission_status',
    'submitted_at',
  ];
  const rows = visits.map((v) =>
    [
      v.visitDatetime.toISOString(),
      v.propertyRef,
      v.address,
      v.prospectName,
      v.agent.name,
      v.agent.email,
      v.agent.branch ?? '',
      v.status,
      v.submission?.status ?? '',
      v.submission?.submittedAt.toISOString() ?? '',
    ]
      .map(csvEscape)
      .join(',')
  );

  const csv = [header.join(','), ...rows].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="viewings-export.csv"',
    },
  });
}
