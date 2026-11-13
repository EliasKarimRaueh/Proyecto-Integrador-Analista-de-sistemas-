/**
 * Adversarial Empirical Stress Harness for Timestamp Logic
 * Testing:
 * 1. fecha() logic from backend (pedidos.ts and compras.ts)
 * 2. timestampParaEnvio() logic from frontend (FormularioAbastecimiento.tsx)
 * 3. hoyComoFechaInput() logic from frontend (money.ts)
 */

function backendFecha(value: unknown, customNow?: Date, mensajeError: string = 'La fecha no es válida.'): Date {
  if (value === undefined || value === null || value === '') return customNow ?? new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const ahora = customNow ?? new Date();
    const [anio, mes, dia] = value.trim().split('-').map(Number);
    const resultado = new Date(ahora);
    resultado.setFullYear(anio, mes - 1, dia);
    if (Number.isNaN(resultado.getTime()) || resultado.getDate() !== dia) {
      throw new Error(mensajeError);
    }
    return resultado;
  }
  const resultado = new Date(String(value));
  if (Number.isNaN(resultado.getTime())) throw new Error(mensajeError);
  return resultado;
}

function frontendTimestampParaEnvio(fechaSeleccionada: string, customNow?: Date): string {
  const ahora = customNow ?? new Date();
  const hoyInput = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  if (!fechaSeleccionada || fechaSeleccionada === hoyInput) {
    return ahora.toISOString();
  }
  const [anio, mes, dia] = fechaSeleccionada.split('-').map(Number);
  const d = new Date(ahora);
  d.setFullYear(anio, mes - 1, dia);
  return d.toISOString();
}

function getDayInBuenosAires(d: Date): { year: number; month: number; day: number; timeStr: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  return {
    year: Number(getPart('year')),
    month: Number(getPart('month')),
    day: Number(getPart('day')),
    timeStr: `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`,
  };
}

console.log('=== RUNNING EMPIRICAL STRESS HARNESS ===');
console.log('Environment process.env.TZ:', process.env.TZ ?? '(unset)');
console.log('Local resolved timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

let totalPassed = 0;
let totalFailed = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, desc: string) {
  if (condition) {
    totalPassed++;
  } else {
    totalFailed++;
    failureDetails.push(desc);
    console.error(`  FAIL: ${desc}`);
  }
}

// -------------------------------------------------------------
// Test Suite 1: Full 24-hour cycle at 15-minute intervals
// Testing whether date-only '2026-05-15' preserves May 15 in Buenos Aires
// across all hours of the day when submitting from local time
// -------------------------------------------------------------
console.log('\n--- Test Suite 1: 24-hour cycle on local submissions ---');
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45, 59]) {
    const s = m === 59 ? 59 : 0;
    // Construct local mock time
    const simulatedNow = new Date(2026, 10, 13, h, m, s); // 2026-11-13 h:m:s local
    
    // Frontend sends timestampParaEnvio
    const tsFromFrontend = frontendTimestampParaEnvio('2026-05-15', simulatedNow);
    // Backend receives that ISO string
    const parsedBackend = backendFecha(tsFromFrontend, simulatedNow);
    
    // Oracle: what is the calendar date in Buenos Aires?
    const ba = getDayInBuenosAires(parsedBackend);
    
    // If the client is in Argentina or simulated local time is in Argentina:
    const clientBA = getDayInBuenosAires(simulatedNow);
    // When frontend runs in client environment, d.setFullYear(2026, 4, 15) sets day 15 local.
    // If client is in Argentina, ba.day MUST be 15!
    if (Intl.DateTimeFormat().resolvedOptions().timeZone.includes('Argentina') ||
        Intl.DateTimeFormat().resolvedOptions().timeZone.includes('Cordoba') ||
        Intl.DateTimeFormat().resolvedOptions().timeZone.includes('Buenos_Aires')) {
      assert(ba.year === 2026 && ba.month === 5 && ba.day === 15,
        `Frontend->Backend pipeline shifted date! h=${h}, m=${m}, s=${s}. Result: ${ba.year}-${ba.month}-${ba.day}`);
    }
    
    // Check that backendFecha directly with date-only preserves day 15 local
    const parsedDirect = backendFecha('2026-05-15', simulatedNow);
    assert(parsedDirect.getFullYear() === 2026 && parsedDirect.getMonth() === 4 && parsedDirect.getDate() === 15,
      `backendFecha direct with date-only shifted local date! h=${h}, m=${m}. Result: ${parsedDirect.toISOString()}`);
  }
}

// -------------------------------------------------------------
// Test Suite 2: Midnight boundaries (23:59:59.999 vs 00:00:00.000 vs 00:00:01.000)
// -------------------------------------------------------------
console.log('\n--- Test Suite 2: Midnight boundary stress ---');
const midnightMoments = [
  new Date(2026, 10, 13, 23, 59, 59, 999),
  new Date(2026, 10, 14, 0, 0, 0, 0),
  new Date(2026, 10, 14, 0, 0, 1, 0),
  new Date('2026-12-31T23:59:59.999Z'),
  new Date('2027-01-01T00:00:00.000Z'),
  new Date('2027-01-01T00:00:01.000Z'),
];

for (const now of midnightMoments) {
  // Test today submission (empty string or today's date)
  const tsToday = frontendTimestampParaEnvio('', now);
  const parsedToday = backendFecha(tsToday, now);
  assert(parsedToday.getTime() === now.getTime(),
    `Empty date submission did not preserve exact midnight timestamp: ${now.toISOString()} vs ${parsedToday.toISOString()}`);

  // Test explicit date submission across midnight
  const tsExplicit = frontendTimestampParaEnvio('2026-07-20', now);
  const parsedExplicit = backendFecha(tsExplicit, now);
  assert(parsedExplicit.toISOString() === tsExplicit,
    `Explicit date submission altered ISO representation across midnight: ${tsExplicit} vs ${parsedExplicit.toISOString()}`);
}

// -------------------------------------------------------------
// Test Suite 3: Leap Day Stress
// -------------------------------------------------------------
console.log('\n--- Test Suite 3: Leap Day Stress ---');
// 2024 is leap year: 2024-02-29 must succeed
try {
  const d2024 = backendFecha('2024-02-29');
  assert(d2024.getFullYear() === 2024 && d2024.getMonth() === 1 && d2024.getDate() === 29,
    'Valid leap day 2024-02-29 failed to parse day 29');
} catch (e: any) {
  assert(false, `Valid leap day 2024-02-29 threw error: ${e.message}`);
}

// 2000 is century leap year: 2000-02-29 must succeed
try {
  const d2000 = backendFecha('2000-02-29');
  assert(d2000.getFullYear() === 2000 && d2000.getMonth() === 1 && d2000.getDate() === 29,
    'Valid century leap day 2000-02-29 failed to parse day 29');
} catch (e: any) {
  assert(false, `Valid century leap day 2000-02-29 threw error: ${e.message}`);
}

// Non-leap years: 2025-02-29, 2026-02-29, 1900-02-29 must throw
for (const nonLeap of ['2025-02-29', '2026-02-29', '1900-02-29']) {
  let threw = false;
  try {
    backendFecha(nonLeap);
  } catch {
    threw = true;
  }
  assert(threw, `Non-leap year ${nonLeap} did NOT throw error in backendFecha!`);
}

// -------------------------------------------------------------
// Test Suite 4: Month bounds stress (days 30 vs 31 vs 32)
// -------------------------------------------------------------
console.log('\n--- Test Suite 4: Month day bounds stress ---');
const invalidDays = [
  '2026-04-31', // April (30)
  '2026-06-31', // June (30)
  '2026-09-31', // September (30)
  '2026-11-31', // November (30)
  '2026-02-30', // February (28)
  '2026-02-31', // February
  '2026-01-32', // Jan 32
  '2026-00-15', // Month 0
  '2026-13-01', // Month 13
];

for (const inv of invalidDays) {
  let threw = false;
  try {
    backendFecha(inv);
  } catch {
    threw = true;
  }
  assert(threw, `Invalid month/day ${inv} did NOT throw error!`);
}

// -------------------------------------------------------------
// Test Suite 5: ISO strings with various timezone offsets
// -------------------------------------------------------------
console.log('\n--- Test Suite 5: ISO strings with timezone offsets ---');
const isoOffsets = [
  { input: '2026-05-15T15:30:00.000Z', expectedUtcMillis: Date.parse('2026-05-15T15:30:00.000Z') },
  { input: '2026-05-15T12:30:00.000-03:00', expectedUtcMillis: Date.parse('2026-05-15T15:30:00.000Z') },
  { input: '2026-05-15T21:00:00.000+05:30', expectedUtcMillis: Date.parse('2026-05-15T15:30:00.000Z') },
  { input: '2026-05-15T00:00:01.000-03:00', expectedUtcMillis: Date.parse('2026-05-15T03:00:01.000Z') },
  { input: '2026-05-15T23:59:59.000-03:00', expectedUtcMillis: Date.parse('2026-05-16T02:59:59.000Z') },
];

for (const item of isoOffsets) {
  const parsed = backendFecha(item.input);
  assert(parsed.getTime() === item.expectedUtcMillis,
    `ISO string ${item.input} parsed into incorrect UTC millis: ${parsed.getTime()} vs ${item.expectedUtcMillis}`);
}

// -------------------------------------------------------------
// Test Suite 6: Never hardcoded to 12:00:00 or 12:00 PM
// -------------------------------------------------------------
console.log('\n--- Test Suite 6: Hardcoded 12:00:00 verification ---');
// Verify that timestampParaEnvio NEVER emits 12:00:00 unless the current time happens to be 12:00:00
for (const testMinute of [0, 1, 15, 30, 45, 59]) {
  const time = new Date(2026, 5, 10, 9, testMinute, 42, 123);
  const ts = frontendTimestampParaEnvio('2026-06-10', time);
  assert(!ts.includes('12:00:00'), `Timestamp contained 12:00:00 for local time 09:${testMinute}:42! ts=${ts}`);
  assert(!ts.includes('T12:00:00-03:00'), `Timestamp contained legacy hardcoded T12:00:00-03:00! ts=${ts}`);
}

// -------------------------------------------------------------
// Test Suite 7: Invalid input types (numbers, objects, garbage)
// -------------------------------------------------------------
console.log('\n--- Test Suite 7: Malformed inputs ---');
const garbageInputs = ['invalid', '2026-99-99', '2026-02-30T00:00:00Z', 'null', '{}', '   ', ''];
for (const g of garbageInputs) {
  if (g === '') {
    // Empty string must return current date, not throw
    const res = backendFecha(g);
    assert(res instanceof Date && !Number.isNaN(res.getTime()), 'Empty string did not return valid Date');
  } else {
    let threw = false;
    try {
      backendFecha(g);
    } catch {
      threw = true;
    }
    assert(threw, `Garbage input "${g}" did NOT throw error!`);
  }
}

console.log(`\n========================================`);
console.log(`STRESS HARNESS COMPLETED:`);
console.log(`  Passed: ${totalPassed}`);
console.log(`  Failed: ${totalFailed}`);
if (totalFailed > 0) {
  console.log(`Failures:`);
  failureDetails.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log(`ALL ADVERSARIAL STRESS SCENARIOS PASSED.`);
}
