const STYLE_ID = 'maple-phone-bank-styles';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const amount = (value) => currency.format(value);
const FILTERS = ['All activity', 'Income', 'Spending'];
const PAGE_SIZE = 20;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.phone-bank { display: flex; flex-direction: column; gap: 12px; color: #eef6f7; }
.phone-bank h3, .phone-bank h4, .phone-bank p { margin: 0; }
.phone-bank-card { padding: 14px; border-radius: 16px; background: linear-gradient(140deg, #17514d, #192e3d); }
.phone-bank-card p { color: #c1e2df; font-size: 12px; }
.phone-bank-card strong { display: block; font-size: clamp(18px, 5vw, 29px); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.phone-bank-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 5px; }
.phone-bank-tile { padding: 7px; border-radius: 10px; background: #1d2d39; font-size: 12px; }
.phone-bank-tile span, .phone-bank-rows small { display: block; color: #bcced7; }
.phone-bank-filter { min-height: 44px; color: inherit; background: #253746; border: 1px solid #607984; border-radius: 10px; padding: 4px 8px; font: inherit; }
.phone-bank-rows { list-style: none; padding: 0; margin: 0; }
.phone-bank-rows li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px 8px; padding: 9px 0; border-bottom: 1px solid #7b9aa146; font-size: 12px; }
.phone-bank-rows li > div { flex: 1 1 98px; overflow-wrap: anywhere; }
.phone-bank-rows small { font-size: 11px; margin-top: 2px; }
.phone-bank-in { color: #a6efc3; }
.phone-bank-out { color: #ffd0ba; }
.phone-bank-empty { color: #c5d8e0; font-size: 12px; }
`;
  document.head.append(style);
}

function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function renderBankApp(screen, ctx) {
  ensureStyles();
  const bank = element('section', '', 'phone-bank');
  const balance = element('strong');
  const card = element('div', '', 'phone-bank-card');
  card.append(element('p', 'Available cash'), balance);

  const summary = element('div', '', 'phone-bank-summary');
  const income = element('strong');
  const spending = element('strong');
  for (const [label, total] of [['Income', income], ['Spending', spending]]) {
    const tile = element('div', '', 'phone-bank-tile');
    tile.append(element('span', label), total);
    summary.append(tile);
  }

  const filter = element('select', '', 'phone-bank-filter');
  filter.setAttribute('aria-label', 'Filter transactions');
  for (const name of FILTERS) {
    const option = element('option', name);
    option.value = name;
    filter.append(option);
  }
  const rows = element('ul', '', 'phone-bank-rows');
  const empty = element('p', '', 'phone-bank-empty');
  const more = element('button', 'Show more', 'phone-task-pin');
  more.type = 'button';
  let limit = PAGE_SIZE;

  function paint() {
    const state = ctx.getFinances?.() ?? { balance: ctx.getMoney?.() ?? 0, income: 0, spending: 0, transactions: [] };
    balance.textContent = amount(state.balance);
    income.textContent = amount(state.income);
    spending.textContent = amount(state.spending);
    const activity = state.transactions.filter(entry => {
      if (filter.value === 'Income') return entry.category !== 'Adjustment' && entry.amount > 0;
      if (filter.value === 'Spending') return entry.category !== 'Adjustment' && entry.amount < 0;
      return true;
    });
    rows.replaceChildren();
    for (const entry of activity.slice(0, limit)) {
      const row = element('li');
      const description = element('div');
      description.append(element('strong', entry.label),
        element('small', [entry.category, entry.time].filter(Boolean).join(' · ')));
      if (entry.balance != null) description.append(element('small', 'Balance ' + amount(entry.balance)));
      const signed = (entry.amount < 0 ? '−' : '+') + amount(Math.abs(entry.amount));
      row.append(description, element('strong', signed, entry.amount < 0 ? 'phone-bank-out' : 'phone-bank-in'));
      rows.append(row);
    }
    empty.hidden = activity.length > 0;
    empty.textContent = state.transactions.length ? 'No matching transactions.' : 'New earnings and purchases will appear here.';
    more.hidden = activity.length <= limit;
  }

  filter.addEventListener('change', () => { limit = PAGE_SIZE; paint(); });
  more.addEventListener('click', () => { limit += PAGE_SIZE; paint(); });
  bank.append(element('h3', 'Maple Lane Bank'), card, summary, element('h4', 'Transactions'), filter, empty, rows, more);
  screen.append(bank);
  paint();
  return ctx.onMoneyChange?.(paint);
}
