/**
 * Export calendrier iCalendar (RFC 5545) sans dépendance : un fichier .ics est
 * du texte structuré, la génération tient en quelques lignes maîtrisées.
 * Périmètre MVP : événements simples (dates UTC, pas de RRULE — la récurrence
 * est déjà dépliée en occurrences par le domaine).
 */

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  start: Date;
  /** Fin exclusive. Pour un événement « journée entière », utiliser allDay. */
  end: Date;
  allDay?: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function toDateStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Échappement RFC 5545 : backslash, point-virgule, virgule, saut de ligne. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Pliage RFC 5545 : lignes de 75 octets max, continuation par « espace ». */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = new TextEncoder().encode(char).length;
    const limit = out.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      out.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current) out.push(current);
  return out.join('\r\n ');
}

export function buildIcsCalendar(events: readonly IcsEvent[]): string {
  const now = toUtcStamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mister-family-map//FR',
    'CALSCALE:GREGORIAN',
  ];

  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcsText(e.uid)}@mister-family-map`);
    lines.push(`DTSTAMP:${now}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toDateStamp(e.start)}`);
      lines.push(`DTEND;VALUE=DATE:${toDateStamp(e.end)}`);
    } else {
      lines.push(`DTSTART:${toUtcStamp(e.start)}`);
      lines.push(`DTEND:${toUtcStamp(e.end)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(e.title)}`);
    if (e.description)
      lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`);
    if (e.url) lines.push(`URL:${escapeIcsText(e.url)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
