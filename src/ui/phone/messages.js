/**
 * Real Messenger phone app: conversation list, resident directory for starting
 * new chats, live two-way chat bubbles, typing indicator, quick-reply chips,
 * and keyword-aware in-character neighbour replies.
 */

const STYLE_ID = 'maple-phone-messages-css';

const CONTACTS = [
  {
    id: 'rita',
    name: 'Rita',
    role: 'Maple Lane Realty',
    initials: 'R',
    color: '#8f3952',
    match: /rita/i,
    quickReplies: ["Thanks for the keys!", "Any tips for Day 1?", "How's rent work?"],
    reply(text) {
      if (/rent|bill|pay|money|cash/i.test(text)) {
        return "Rent comes due every week — grab shifts with Dottie at the Laundromat or check in with Vince at the Market to stay ahead!";
      }
      if (/kyle|tenant|note|floor/i.test(text)) {
        return "Kyle left in such a rush he barely packed. Walt down by the Trailer Park knows more about that than I do.";
      }
      if (/thank|key|house|home/i.test(text)) {
        return "You're so welcome! Make yourself at home on Maple Lane — reach out anytime if you need anything.";
      }
      return "Settling in alright? Stop by Maple Lane Market to meet Vince, and say hi to Sam and June across the street!";
    }
  },
  {
    id: 'sam',
    name: 'Sam',
    role: 'Neighbour · Maple Lane',
    initials: 'S',
    color: '#2e7d6b',
    match: /\bsam\b/i,
    quickReplies: ["Hey Sam! What's up?", "Heard anything about Kyle?", "Where do you hang out?"],
    reply(text) {
      if (/kyle|note|story|walt/i.test(text)) {
        return "Yeah, Kyle packed up overnight last month. Walt down at the Trailer Park saw the whole thing — definitely talk to him.";
      }
      if (/snack|food|eat|market/i.test(text)) {
        return "Vince keeps the Market stocked with fresh groceries, and there's always the vending machine out front in a pinch!";
      }
      if (/hi|hey|hello|up/i.test(text)) {
        return "Hey neighbour! Welcome to the block. I'm usually walking along Maple Lane or hanging out by the park if you want to chat.";
      }
      return "Good hearing from you! Swing by anytime — Maple Lane's quiet, but there's always something going on.";
    }
  },
  {
    id: 'june',
    name: 'June',
    role: 'Neighbour · Maple Lane',
    initials: 'J',
    color: '#c66549',
    match: /\bjune\b/i,
    quickReplies: ["Hey June!", "Any good coffee nearby?", "How's the neighbourhood?"],
    reply(text) {
      if (/coffee|drink|fuel|gas/i.test(text)) {
        return "Fuel & Go at the east end has the strongest coffee in town — grab a cup next time you fill up your pickup!";
      }
      if (/park|walk|weather/i.test(text)) {
        return "Maple Lane Park is lovely in the afternoon, especially down by the pond and swings.";
      }
      return "Hi there! So glad someone finally moved into that house. Stop and say hello next time you're out on the sidewalk!";
    }
  },
  {
    id: 'vince',
    name: 'Vince',
    role: 'Maple Lane Market',
    initials: 'V',
    color: '#3f7a47',
    match: /\bvince\b|market/i,
    quickReplies: ["What's in stock today?", "Need any help at the store?", "See you soon!"],
    reply(text) {
      if (/work|job|shift|help/i.test(text)) {
        return "Always appreciate an extra pair of hands! Stop by the Market counter or ask Dottie at the Laundromat for a shift.";
      }
      if (/stock|food|buy|grocer|snack/i.test(text)) {
        return "Fresh groceries, snacks, and drinks are stocked on the shelves all day. Come on by Maple Lane Market!";
      }
      return "Door's open at Maple Lane Market whenever you need supplies. Good to have you in town!";
    }
  },
  {
    id: 'dottie',
    name: 'Dottie',
    role: 'Maple Lane Laundromat',
    initials: 'D',
    color: '#6b599e',
    match: /\bdottie\b|laundro/i,
    quickReplies: ["Need help with a shift?", "How's the laundromat?", "Thanks Dottie!"],
    reply(text) {
      if (/work|job|shift|help|cash|pay/i.test(text)) {
        return "Sure do, hon! Come on down to the Laundromat at the east end — wash, dry, fold, and I pay cash right at the counter.";
      }
      if (/wash|clean|clothes|soap/i.test(text)) {
        return "Detergent's right out front in the machine, and the washers are humming all day.";
      }
      return "Hey hon! Pop into the Laundromat whenever you want to pick up a shift or freshen up your clothes.";
    }
  },
  {
    id: 'walt',
    name: 'Walt',
    role: 'Trailer Park',
    initials: 'W',
    color: '#9c6f33',
    match: /\bwalt\b|trailer/i,
    quickReplies: ["What happened to Kyle?", "How long have you lived here?", "See you around, Walt."],
    reply(text) {
      if (/kyle|note|left|rush|happen/i.test(text)) {
        return "Don't like putting it all in a text. Come find me down by the Trailer Park and I'll tell you straight.";
      }
      return "Keep your eyes open and your bills paid, kid. You'll do alright on Maple Lane.";
    }
  },
  {
    id: 'maya',
    name: 'Dr. Maya',
    role: 'Maple Lane Clinic',
    initials: 'M',
    color: '#2c779e',
    match: /maya|clinic|doctor/i,
    quickReplies: ["Hey Dr. Maya!", "Any health tips?", "Thanks!"],
    reply(text) {
      if (/tired|sleep|energy|hungry|health|tip/i.test(text)) {
        return "Moving takes a lot out of you — keep your hunger and energy up, and get a full night's sleep at home before you burn out.";
      }
      return "Welcome to Maple Lane! Stop by the Clinic anytime if you need a check-up or a breather.";
    }
  },
  {
    id: 'marcus',
    name: 'Marcus',
    role: 'Maple Lane Resident',
    initials: 'M',
    color: '#4c5f78',
    match: /\bmarcus\b/i,
    quickReplies: ["Nice day out!", "Know a good mechanic?", "Catch you later!"],
    reply(text) {
      if (/truck|car|gas|fuel|mechanic/i.test(text)) {
        return "That green pickup of yours is solid. Keep the tank topped off at Fuel & Go and she'll run forever.";
      }
      return "Hey! Good seeing a new face around the neighbourhood. Wave if you see me out walking.";
    }
  },
  {
    id: 'hank',
    name: 'Hank',
    role: 'Maple Lane Post Office',
    initials: 'H',
    color: '#345d8c',
    match: /\bhank\b|post office|mail/i,
    quickReplies: ["Any mail for PO Box #14?", "When is the Post Office open?", "Thanks Hank!"],
    reply(text) {
      if (/box|mail|letter|package|14/i.test(text)) {
        return "Your PO Box #14 is right inside the lobby on Maple Lane! Swing by the counter anytime.";
      }
      return "Maple Lane Post Office is right down the block — rain or shine, the mail goes through!";
    }
  }
];

const CSS = `
.msg-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 0;
  color: #e8edf5;
  font-family: system-ui, -apple-system, sans-serif;
}
.msg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 8px;
  flex-shrink: 0;
}
.msg-header-title {
  margin: 0;
  font: 700 18px/1.15 system-ui, sans-serif;
  color: #f4f7fb;
  letter-spacing: -0.01em;
}
.msg-new-btn {
  border: none;
  border-radius: 999px;
  background: #1a73e8;
  color: #fff;
  font: 600 11px/1 system-ui, sans-serif;
  padding: 6px 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.35);
}
.msg-new-btn:hover { background: #2b7de9; }

.msg-search {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: #f1f5fb;
  font: 400 12px/1.2 system-ui, sans-serif;
  padding: 7px 12px;
  margin-bottom: 8px;
  outline: none;
  flex-shrink: 0;
}
.msg-search::placeholder { color: rgba(255, 255, 255, 0.45); }
.msg-search:focus { border-color: rgba(138, 180, 248, 0.65); background: rgba(255, 255, 255, 0.10); }

.msg-contacts-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0 8px;
  scrollbar-width: none;
  flex-shrink: 0;
}
.msg-contacts-bar::-webkit-scrollbar { display: none; }
.msg-contact-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font: 500 10px/1.1 system-ui, sans-serif;
  padding: 2px 3px;
  cursor: pointer;
  flex: 0 0 auto;
}
.msg-contact-chip:hover .msg-avatar { transform: scale(1.06); }

.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: 700 13px/1 system-ui, sans-serif;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.14s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
}
.msg-avatar.sm { width: 28px; height: 28px; font-size: 11px; }

.msg-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 2px;
}
.msg-thread-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.045);
  color: inherit;
  padding: 8px 9px;
  cursor: pointer;
  transition: background 0.14s ease;
}
.msg-thread-row:hover { background: rgba(255, 255, 255, 0.10); }
.msg-thread-row.is-unread { background: rgba(26, 115, 232, 0.14); }
.msg-thread-meta {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.msg-thread-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}
.msg-thread-name {
  font: 600 13px/1.2 system-ui, sans-serif;
  color: #f4f7fb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg-thread-time {
  font: 500 10px/1 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.48);
  flex-shrink: 0;
}
.msg-thread-snippet {
  font: 400 11.5px/1.25 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.64);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg-thread-row.is-unread .msg-thread-snippet {
  color: #e6eefb;
  font-weight: 500;
}
.msg-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4da3ff;
  flex-shrink: 0;
}

/* Active conversation thread */
.msg-chat-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.msg-back-btn {
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #e8edf5;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: 600 14px/1 system-ui, sans-serif;
  cursor: pointer;
  flex-shrink: 0;
}
.msg-back-btn:hover { background: rgba(255, 255, 255, 0.16); }
.msg-chat-title-wrap {
  min-width: 0;
  flex: 1 1 auto;
}
.msg-chat-name {
  font: 600 13.5px/1.15 system-ui, sans-serif;
  color: #f6f9fd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.msg-chat-sub {
  font: 400 10.5px/1.2 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.55);
}

.msg-bubbles {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 2px 8px;
}
.msg-bubble-row {
  display: flex;
  flex-direction: column;
  max-width: 86%;
  align-self: flex-start;
}
.msg-bubble-row.is-me {
  align-self: flex-end;
  align-items: flex-end;
}
.msg-bubble {
  padding: 8px 11px;
  border-radius: 16px 16px 16px 5px;
  background: #272e3b;
  color: #eef3fa;
  font: 400 12px/1.38 system-ui, sans-serif;
  word-wrap: break-word;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
}
.msg-bubble-row.is-me .msg-bubble {
  border-radius: 16px 16px 5px 16px;
  background: #1a73e8;
  color: #ffffff;
}
.msg-bubble-time {
  margin-top: 2px;
  padding: 0 4px;
  font: 400 9.5px/1.1 system-ui, sans-serif;
  color: rgba(255, 255, 255, 0.42);
}
.msg-typing {
  align-self: flex-start;
  padding: 7px 12px;
  border-radius: 14px;
  background: #272e3b;
  color: rgba(255, 255, 255, 0.72);
  font: 700 12px/1 system-ui, sans-serif;
  letter-spacing: 2px;
}

.msg-quick-row {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding: 4px 0 6px;
  scrollbar-width: none;
  flex-shrink: 0;
}
.msg-quick-row::-webkit-scrollbar { display: none; }
.msg-quick-chip {
  border: 1px solid rgba(138, 180, 248, 0.35);
  border-radius: 999px;
  background: rgba(26, 115, 232, 0.14);
  color: #a8c7fa;
  font: 500 11px/1.1 system-ui, sans-serif;
  padding: 5px 9px;
  white-space: nowrap;
  cursor: pointer;
  flex: 0 0 auto;
}
.msg-quick-chip:hover { background: rgba(26, 115, 232, 0.28); color: #fff; }

.msg-composer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.msg-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font: 400 12px/1.25 system-ui, sans-serif;
  padding: 8px 12px;
  outline: none;
}
.msg-input::placeholder { color: rgba(255, 255, 255, 0.45); }
.msg-input:focus { border-color: #669df6; background: rgba(255, 255, 255, 0.12); }
.msg-send-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #1a73e8;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}
.msg-send-btn:hover { background: #2b7de9; }
`;

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function getInbox(ctx) {
  if (!ctx) return [];
  if (typeof ctx.getInbox === 'function') return ctx.getInbox() || [];
  if (ctx.inbox && typeof ctx.inbox.get === 'function') return ctx.inbox.get() || [];
  if (Array.isArray(ctx.inbox)) return ctx.inbox;
  return [];
}

function findContact(fromOrId) {
  const key = String(fromOrId || '');
  for (let i = 0; i < CONTACTS.length; i++) {
    if (CONTACTS[i].id === key || CONTACTS[i].match.test(key)) return CONTACTS[i];
  }
  return null;
}

function fallbackColor(name) {
  const palette = ['#4b6b8a', '#6d5d8c', '#3d7a6e', '#946644', '#7a5163'];
  let hash = 0;
  const str = String(name || 'M');
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function formatNow(ctx) {
  const t = ctx && typeof ctx.getTime === 'function' ? ctx.getTime() : null;
  if (t && t.formatted) return t.formatted;
  if (t && t.day != null) return 'Day ' + (t.day | 0);
  return 'Now';
}

function currentDay(ctx) {
  const t = ctx && typeof ctx.getTime === 'function' ? ctx.getTime() : null;
  return t && t.day != null ? (t.day | 0) : 1;
}

function groupThreads(list) {
  const map = new Map();
  // Inbox is stored newest-first; iterate oldest-first to build chronological bubbles.
  for (let i = list.length - 1; i >= 0; i--) {
    const msg = list[i];
    if (!msg) continue;
    const contact = findContact(msg.threadId || msg.from);
    const id = msg.threadId || (contact ? contact.id : (msg.from || 'mail'));
    let thread = map.get(id);
    if (!thread) {
      thread = {
        id,
        name: contact ? contact.name : (msg.from || 'Mail'),
        role: contact ? contact.role : 'Maple Lane Mail',
        initials: contact ? contact.initials : String(msg.from || 'M').trim().charAt(0).toUpperCase(),
        color: contact ? contact.color : fallbackColor(msg.from),
        contact,
        messages: [],
        unread: 0
      };
      map.set(id, thread);
    }
    thread.messages.push(msg);
    if (msg.sender !== 'me' && msg.read !== true) thread.unread += 1;
  }
  // Most recently active threads first.
  return [...map.values()].reverse();
}

export function renderMessagesApp(screen, ctx = {}) {
  if (!screen) return;
  ensureStyles();

  let activeThreadId = null;
  let searchQuery = '';
  let showDirectory = false;
  let typingThreadId = null;
  let replyTimer = null;
  // Local fallback store when rendered in isolation without addInboxMessage.
  let localMessages = null;

  function readList() {
    return localMessages != null ? localMessages : getInbox(ctx);
  }

  function pushMessage(msg) {
    if (ctx && typeof ctx.addInboxMessage === 'function') {
      ctx.addInboxMessage(msg);
    } else if (ctx && ctx.inbox && typeof ctx.inbox.add === 'function') {
      ctx.inbox.add(msg);
    } else {
      localMessages = [msg, ...readList()];
      paint();
    }
  }

  function markThreadRead(threadId, fromName) {
    if (ctx && typeof ctx.markInboxRead === 'function') {
      ctx.markInboxRead(threadId);
      if (fromName && fromName !== threadId) ctx.markInboxRead(fromName);
    } else if (localMessages) {
      localMessages = localMessages.map((m) => (
        m && (m.threadId === threadId || m.from === fromName) ? { ...m, read: true } : m
      ));
    }
  }

  function openThread(threadId) {
    activeThreadId = threadId;
    showDirectory = false;
    const contact = findContact(threadId);
    markThreadRead(threadId, contact ? contact.name : threadId);
    paint();
  }

  function sendText(thread, rawText) {
    const body = String(rawText || '').trim();
    if (!body) return;
    const stamp = formatNow(ctx);
    const day = currentDay(ctx);
    pushMessage({
      id: 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      threadId: thread.id,
      from: thread.name,
      sender: 'me',
      body,
      day,
      time: stamp,
      read: true
    });
    ctx?.onTextSent?.(thread.id, thread.name);

    if (thread.contact) {
      typingThreadId = thread.id;
      paint();
      if (replyTimer) window.clearTimeout(replyTimer);
      replyTimer = window.setTimeout(() => {
        replyTimer = null;
        typingThreadId = null;
        const replyBody = thread.contact.reply(body);
        pushMessage({
          id: 'reply-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          threadId: thread.id,
          from: thread.contact.name,
          sender: 'them',
          body: replyBody,
          day: currentDay(ctx),
          time: formatNow(ctx),
          read: activeThreadId === thread.id
        });
        ctx?.previewNotification?.();
      }, 650);
    }
  }

  function paint() {
    screen.innerHTML = '';
    screen.classList.add('phone-screen');

    const root = document.createElement('div');
    root.className = 'msg-app';

    const list = readList();
    const threads = groupThreads(list);

    if (activeThreadId) {
      let thread = threads.find((t) => t.id === activeThreadId);
      if (!thread) {
        const c = findContact(activeThreadId);
        thread = {
          id: activeThreadId,
          name: c ? c.name : activeThreadId,
          role: c ? c.role : 'Maple Lane',
          initials: c ? c.initials : activeThreadId.charAt(0).toUpperCase(),
          color: c ? c.color : fallbackColor(activeThreadId),
          contact: c,
          messages: []
        };
      }

      // Chat header
      const top = document.createElement('div');
      top.className = 'msg-chat-top';
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'msg-back-btn';
      back.setAttribute('aria-label', 'Back to conversations');
      back.textContent = '←';
      back.addEventListener('click', () => {
        activeThreadId = null;
        paint();
      });
      const av = document.createElement('span');
      av.className = 'msg-avatar sm';
      av.style.background = thread.color;
      av.textContent = thread.initials;
      const titleWrap = document.createElement('div');
      titleWrap.className = 'msg-chat-title-wrap';
      const nameEl = document.createElement('div');
      nameEl.className = 'msg-chat-name';
      nameEl.textContent = thread.name;
      const subEl = document.createElement('div');
      subEl.className = 'msg-chat-sub';
      const friend = thread.contact && typeof ctx.getFriendship === 'function' ? ctx.getFriendship(thread.id) : null;
      subEl.textContent = friend
        ? `${thread.role} · ${'♥'.repeat(friend.hearts)} ${friend.label}`
        : thread.role;
      titleWrap.append(nameEl, subEl);
      top.append(back, av, titleWrap);
      root.appendChild(top);

      // Bubbles feed
      const feed = document.createElement('div');
      feed.className = 'msg-bubbles';
      feed.setAttribute('role', 'log');
      if (!thread.messages.length) {
        const empty = document.createElement('p');
        empty.className = 'phone-placeholder';
        empty.textContent = `Say hi to ${thread.name}!`;
        feed.appendChild(empty);
      } else {
        for (let i = 0; i < thread.messages.length; i++) {
          const m = thread.messages[i];
          const isMe = m.sender === 'me';
          const row = document.createElement('div');
          row.className = 'msg-bubble-row' + (isMe ? ' is-me' : '');
          const bubble = document.createElement('div');
          bubble.className = 'msg-bubble';
          bubble.textContent = m.body || '';
          const time = document.createElement('div');
          time.className = 'msg-bubble-time';
          const stamp = m.time || (m.day != null ? 'Day ' + (m.day | 0) : '');
          time.textContent = isMe ? (stamp ? `${stamp} · ✓✓` : '✓✓') : stamp;
          row.append(bubble, time);
          feed.appendChild(row);
        }
      }
      if (typingThreadId === thread.id) {
        const typing = document.createElement('div');
        typing.className = 'msg-typing';
        typing.textContent = '• • •';
        feed.appendChild(typing);
      }
      root.appendChild(feed);

      // Quick replies + composer (for interactive contacts)
      if (thread.contact) {
        const quickRow = document.createElement('div');
        quickRow.className = 'msg-quick-row';
        for (const replyText of thread.contact.quickReplies) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'msg-quick-chip';
          chip.textContent = replyText;
          chip.addEventListener('click', () => sendText(thread, replyText));
          quickRow.appendChild(chip);
        }
        root.appendChild(quickRow);

        const composer = document.createElement('form');
        composer.className = 'msg-composer';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'msg-input';
        input.placeholder = `Text ${thread.name}…`;
        input.setAttribute('aria-label', `Message ${thread.name}`);
        input.addEventListener('keydown', (e) => e.stopPropagation());
        const sendBtn = document.createElement('button');
        sendBtn.type = 'submit';
        sendBtn.className = 'msg-send-btn';
        sendBtn.setAttribute('aria-label', 'Send message');
        sendBtn.textContent = '➤';
        composer.addEventListener('submit', (e) => {
          e.preventDefault();
          const val = input.value;
          input.value = '';
          sendText(thread, val);
        });
        composer.append(input, sendBtn);
        root.appendChild(composer);
      }

      screen.appendChild(root);
      feed.scrollTop = feed.scrollHeight;
      return;
    }

    // --- Conversation List View ---
    const header = document.createElement('div');
    header.className = 'msg-header';
    const title = document.createElement('h3');
    title.className = 'msg-header-title';
    title.textContent = 'Messages';
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'msg-new-btn';
    newBtn.textContent = showDirectory ? 'Close' : '+ New';
    newBtn.addEventListener('click', () => {
      showDirectory = !showDirectory;
      paint();
    });
    header.append(title, newBtn);
    root.appendChild(header);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'msg-search';
    search.placeholder = 'Search conversations…';
    search.value = searchQuery;
    search.setAttribute('aria-label', 'Search messages');
    search.addEventListener('keydown', (e) => e.stopPropagation());
    search.addEventListener('input', () => {
      searchQuery = search.value;
      paint();
    });
    root.appendChild(search);

    if (showDirectory || !threads.length) {
      const bar = document.createElement('div');
      bar.className = 'msg-contacts-bar';
      for (const c of CONTACTS) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'msg-contact-chip';
        chip.title = `Message ${c.name} (${c.role})`;
        const av = document.createElement('span');
        av.className = 'msg-avatar';
        av.style.background = c.color;
        av.textContent = c.initials;
        const lbl = document.createElement('span');
        lbl.textContent = c.name;
        chip.append(av, lbl);
        chip.addEventListener('click', () => openThread(c.id));
        bar.appendChild(chip);
      }
      root.appendChild(bar);
    }

    const q = searchQuery.trim().toLowerCase();
    const visible = q
      ? threads.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.messages.some((m) => String(m.body || '').toLowerCase().includes(q)))
      : threads;

    if (!visible.length) {
      const p = document.createElement('p');
      p.className = 'phone-placeholder';
      p.textContent = threads.length ? 'No matching conversations.' : 'No new messages.';
      root.appendChild(p);
      screen.appendChild(root);
      return;
    }

    const listEl = document.createElement('div');
    listEl.className = 'msg-list phone-messages';
    listEl.setAttribute('role', 'list');
    for (let i = 0; i < visible.length; i++) {
      const t = visible[i];
      const latest = t.messages[t.messages.length - 1] || {};
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'msg-thread-row phone-message' + (t.unread > 0 ? ' is-unread' : '');
      row.setAttribute('role', 'listitem');
      const av = document.createElement('span');
      av.className = 'msg-avatar';
      av.style.background = t.color;
      av.textContent = t.initials;

      const meta = document.createElement('div');
      meta.className = 'msg-thread-meta';
      const top = document.createElement('div');
      top.className = 'msg-thread-top';
      const nameEl = document.createElement('span');
      nameEl.className = 'msg-thread-name phone-message-from';
      nameEl.textContent = t.name;
      const timeEl = document.createElement('span');
      timeEl.className = 'msg-thread-time phone-message-day';
      timeEl.textContent = latest.time || (latest.day != null ? 'Day ' + (latest.day | 0) : '');
      top.append(nameEl, timeEl);

      const snip = document.createElement('div');
      snip.className = 'msg-thread-snippet phone-message-body';
      snip.textContent = (latest.sender === 'me' ? 'You: ' : '') + (latest.body || '');

      meta.append(top, snip);
      row.append(av, meta);
      if (t.unread > 0) {
        const dot = document.createElement('span');
        dot.className = 'msg-unread-dot';
        dot.setAttribute('aria-label', `${t.unread} unread`);
        row.appendChild(dot);
      }
      row.addEventListener('click', () => openThread(t.id));
      listEl.appendChild(row);
    }
    root.appendChild(listEl);
    screen.appendChild(root);
  }

  paint();
  const off = ctx && typeof ctx.onInboxChange === 'function'
    ? ctx.onInboxChange(() => paint())
    : null;
  return () => {
    if (replyTimer) window.clearTimeout(replyTimer);
    if (typeof off === 'function') off();
  };
}

export default renderMessagesApp;
