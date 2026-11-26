import { attachMailboxMoney } from '../systems/money.js';
import { queueMail } from '../data/mail.js';

/**
 * The mailbox's daily delivery: cash, messages and items arrive once per game
 * day (src/data/mail.js) and are collected by opening the mailbox.
 */
export function setupDailyMail(g) {
  const { scene, clock, mode } = g;
  const mailbox = scene.userData.mailbox || (scene.getObjectByName && scene.getObjectByName('mailbox'));
  attachMailboxMoney({
    mailbox,
    money: g.money,
    sfx: g.sfx,
    toast: (msg) => g.hud.toast(msg),
    inbox: g.inbox,
    toastMessages: false,
    inventory: g.inventory
  });
  window.addEventListener('maple-new-day', (e) => {
    const mail = mailbox && mailbox.userData && mailbox.userData.mail;
    const day = e && e.detail && e.detail.day;
    queueMail(mail, day);
    if (!mode.busy()) g.save();
  });
  // A save from an earlier day: today's mail may not have been rolled yet.
  const mailState = mailbox && mailbox.userData && mailbox.userData.mail;
  const dayNow = clock.getTime().day;
  if (mailState && dayNow >= 2 && mailState.lastMailDay !== dayNow) queueMail(mailState, dayNow);
}
