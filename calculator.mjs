export const cycleDays = { monthly: 365.25 / 12, quarterly: 365.25 / 4,
  semiannually: 365.25 / 2, annually: 365.25, biennially: 365.25 * 2,
  triennially: 365.25 * 3, quinquennially: 365.25 * 5 };
const cycleNames = { monthly: '月', quarterly: '季', semiannually: '半年',
  annually: '年', biennially: '两年', triennially: '三年', quinquennially: '五年' };
const currencies = ['USD', 'GBP', 'EUR', 'JPY', 'KRW', 'HKD', 'TWD', 'CAD', 'SGD', 'AUD', 'CNY'];
const defaultSources = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cny.json',
  'https://latest.currency-api.pages.dev/v1/currencies/cny.json',
];
export const xml = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

function dateNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date');
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
  return ms / 86400000;
}

export function calculateCard(params, tradeDate) {
  const amount = params.get('amount');
  const rate = params.get('rate');
  const currency = params.get('currency');
  const cycle = params.get('cycle');
  const expiry = params.get('expiry');
  if (!amount?.trim() || !rate?.trim() || !currencies.includes(currency) ||
      !Object.hasOwn(cycleDays, cycle)) throw new Error('Invalid card parameters');
  const money = Number(amount), exchange = Number(rate);
  if (!Number.isFinite(money) || money < 0 || !Number.isFinite(exchange) || exchange < 0) throw new Error('Invalid amount or rate');
  const remainingDays = Math.max(0, dateNumber(expiry ?? '') - dateNumber(tradeDate) + 1);
  const totalValue = money * exchange;
  const remainingValue = totalValue / cycleDays[cycle] * remainingDays;
  if (!Number.isFinite(totalValue) || !Number.isFinite(remainingValue)) throw new Error('Amount too large');
  return { remainingDays, remainingValue: remainingValue.toFixed(2), totalValue: totalValue.toFixed(2),
    expiry, trade: tradeDate, renewal: `${money.toFixed(2)} ${currency} / ${cycleNames[cycle]}`, rate: exchange.toFixed(4) };
}

export function today(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function createRatesService({ fetcher = fetch, sources = defaultSources, now = Date.now,
  cacheMs = 6 * 60 * 60 * 1000 } = {}) {
  let cached, refreshAfter = 0, inFlight;
  return async function getRates() {
    if (now() < refreshAfter) return cached ?? { success: false };
    if (inFlight) return inFlight;
    inFlight = (async () => {
      for (const source of sources) {
        try {
          const response = await fetcher(source, { signal: AbortSignal.timeout(5000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          dateNumber(data.date ?? '');
          const rates = {};
          for (const code of currencies) {
            const quoted = data.cny?.[code.toLowerCase()];
            if (typeof quoted !== 'number' || !Number.isFinite(quoted) || quoted <= 0 || !Number.isFinite(1 / quoted)) throw new Error('Invalid currency data');
            rates[code] = code === 'CNY' ? 1 : 1 / quoted;
          }
          cached = { success: true, last_updated_utc: `${data.date}T00:00:00Z`, base_code: 'CNY', rates };
          refreshAfter = now() + cacheMs;
          return cached;
        } catch {
          // Try the independent fallback; never label static values as live rates.
        }
      }
      refreshAfter = now() + 60000;
      return cached ?? { success: false };
    })();
    try { return await inFlight; } finally { inFlight = undefined; }
  };
}

