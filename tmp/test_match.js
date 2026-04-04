
const normalizeID = (val) => {
  if (val === null || val === undefined) return '';
  let s = String(val).trim().replace(/[^\d]/g, '');
  if (!s) return '';
  if (s.length === 13) {
    const prefixos = ['84444', '14444', '15555', '10211', '10542', '10811'];
    for (const p of prefixos) {
      if (s.startsWith(p)) {
        s = s.substring(p.length);
        break;
      }
    }
  }
  const normalized = s.replace(/^0+/, '');
  return normalized || s;
};

const tests = [
  { input: '3683', expected: '3683' },
  { input: 3683, expected: '3683' },
  { input: '8444400003683', expected: '3683' },
  { input: '1444400003683', expected: '3683' },
  { input: '0000446279', expected: '446279' },
  { input: '1.444422e+12', expected: '44422' }, // Note: replace(/[^\d]/g) will see '144442212'
  { input: 1444422000000, expected: '22000000' } // Last part after 14444
];

tests.forEach(t => {
  const result = normalizeID(t.input);
  console.log(`Input: ${t.input} -> Result: ${result} (Expected: ${t.expected}) - ${result === t.expected ? '✅' : '❌'}`);
});
