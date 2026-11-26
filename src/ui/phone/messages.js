/**
 * Messages app: an inbox of collected mailbox notes.
 * When the inbox is empty the screen still uses .phone-placeholder
 * and the text "No new messages." so the existing phone tests stay valid.
 */

function getInbox(ctx) {
  if (!ctx) return null;
  if (typeof ctx.getInbox === 'function') return ctx.getInbox();
  if (ctx.inbox && typeof ctx.inbox.get === 'function') return ctx.inbox.get();
  if (Array.isArray(ctx.inbox)) return ctx.inbox;
  return null;
}

function paint(screen, ctx) {
  screen.innerHTML = '';
  screen.classList.add('phone-screen');

  const title = document.createElement('h3');
  title.className = 'phone-app-title';
  title.textContent = 'Messages';
  screen.appendChild(title);

  const list = getInbox(ctx) || [];
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'phone-placeholder';
    p.textContent = 'No new messages.';
    screen.appendChild(p);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'phone-messages';
  wrap.setAttribute('role', 'list');
  for (let i = 0; i < list.length; i++) {
    const msg = list[i] || {};
    const row = document.createElement('article');
    row.className = 'phone-message';
    row.setAttribute('role', 'listitem');
    const from = document.createElement('div');
    from.className = 'phone-message-from';
    from.textContent = msg.from || 'Mail';
    row.appendChild(from);
    if (msg.day != null) {
      const meta = document.createElement('div');
      meta.className = 'phone-message-day';
      meta.textContent = 'Day ' + (msg.day | 0);
      row.appendChild(meta);
    }
    const body = document.createElement('p');
    body.className = 'phone-message-body';
    body.textContent = msg.body || '';
    row.appendChild(body);
    wrap.appendChild(row);
  }
  screen.appendChild(wrap);
}

export function renderMessagesApp(screen, ctx = {}) {
  if (!screen) return;
  paint(screen, ctx);
  const off = ctx && typeof ctx.onInboxChange === 'function'
    ? ctx.onInboxChange(() => paint(screen, ctx))
    : null;
  return () => { if (typeof off === 'function') off(); };
}

export default renderMessagesApp;
