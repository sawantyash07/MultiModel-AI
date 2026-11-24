function parseTimestamp(raw, id) {
  if (!raw && id) {
    const match = String(id).match(/msg-(\d{10,14})/);
    if (match) {
      const num = Number(match[1]);
      if (!isNaN(num) && num > 1000000000000) return new Date(num);
    }
  }
  if (!raw) return null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    if (/^\d{10,14}$/.test(trimmed)) {
      const d = new Date(Number(trimmed));
      return isNaN(d.getTime()) ? null : d;
    }
    // Check Java Date.toString() format: 'Wed Oct 21 19:47:01 IST 2026'
    const javaDateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Za-z0-9_+-]+)?\s*(\d{4})$/);
    if (javaDateMatch) {
      const month = javaDateMatch[1];
      const day = javaDateMatch[2];
      const time = javaDateMatch[3];
      const year = javaDateMatch[5];
      const d = new Date(month + ' ' + day + ' ' + year + ' ' + time);
      if (!isNaN(d.getTime())) return d;
    }
    // Check ISO format with >3 fractional seconds
    const sanitizedIso = trimmed.replace(/(\.\d{3})\d+([Z+-])/, '$1$2');
    const dIso = new Date(sanitizedIso);
    if (!isNaN(dIso.getTime())) return dIso;

    const dDirect = new Date(trimmed);
    if (!isNaN(dDirect.getTime())) return dDirect;
  }
  return null;
}

const tests = [
  'Wed Oct 21 19:47:01 IST 2026',
  '2026-10-21T14:17:01.442489200Z',
  1792592221495,
  '1792592221495',
  null,
  'invalid string',
  'Mon Oct 19 19:43:48 IST 2026'
];

tests.forEach(t => {
  const d = parseTimestamp(t, 'msg-1792592221495-user');
  console.log(String(t), '=>', d ? d.toLocaleString('en-US') : 'null');
});
