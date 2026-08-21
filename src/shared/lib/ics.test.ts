import { describe, expect, it } from 'vitest';
import { buildIcsCalendar, escapeIcsText } from './ics';

describe('escapeIcsText', () => {
  it('échappe backslash, point-virgule, virgule et sauts de ligne', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
});

describe('buildIcsCalendar', () => {
  const base = {
    uid: 'evt-1',
    title: 'Chasse au trésor',
    start: new Date(Date.UTC(2026, 8, 19, 14, 0, 0)),
    end: new Date(Date.UTC(2026, 8, 19, 16, 30, 0)),
  };

  it('produit un calendrier valide avec CRLF', () => {
    const ics = buildIcsCalendar([base]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20260919T140000Z');
    expect(ics).toContain('DTEND:20260919T163000Z');
    expect(ics).toContain('SUMMARY:Chasse au trésor');
  });

  it('événement journée entière → VALUE=DATE sans heure', () => {
    const ics = buildIcsCalendar([
      {
        ...base,
        allDay: true,
        end: new Date(Date.UTC(2026, 8, 20)),
      },
    ]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260919');
    expect(ics).toContain('DTEND;VALUE=DATE:20260920');
  });

  it('plie les lignes longues à 75 octets max', () => {
    const ics = buildIcsCalendar([{ ...base, description: 'x'.repeat(300) }]);
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
