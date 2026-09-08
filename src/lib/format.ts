export function formatWaiting(from: Date, now = new Date()): string {
  const hours = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 3600_000));
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
}

export function formatVisitTime(d: Date): { time: string; date: string } {
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { time, date };
}
