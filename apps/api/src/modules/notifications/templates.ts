export interface Template { subject: string; body: string }
/** Plain-text defaults. An NGO can override any of these, per language, in Settings. */
export const TEMPLATES: Record<string, Template> = {
  'auth.verify': { subject: 'Confirm your email for {{org}}', body: 'Hello {{name}},\n\nConfirm your email address to finish creating your account:\n{{link}}\n\nThis link works for 24 hours.' },
  'auth.exists': { subject: 'You already have an account with {{org}}', body: 'Hello {{name}},\n\nSomeone tried to register with this email address, which already has an account. If that was you, sign in or reset your password here:\n{{link}}' },
  'auth.reset': { subject: 'Reset your password', body: 'Hello {{name}},\n\nReset your password here:\n{{link}}\n\nThis link works for 1 hour. If you did not ask for it, you can ignore this email.' },
  'auth.password_changed': { subject: 'Your password was changed', body: 'Hello {{name}},\n\nYour password was just changed and other devices were signed out. If this was not you, reset your password now:\n{{link}}' },
  'member.invite': { subject: 'You are invited to join {{org}}', body: 'Hello,\n\n{{inviter}} invited you to join {{org}}. Accept here:\n{{link}}\n\nThis link works for 7 days.' },
  'donation.thanks': { subject: 'Thank you for your donation to {{org}}', body: 'Dear {{name}},\n\nThank you for your donation of {{amount}}. Receipt number: {{receipt}}.\n\nDownload your receipt:\n{{link}}\n\nWith gratitude,\n{{org}}' },
  'donation.refunded': { subject: 'Your donation was refunded', body: 'Dear {{name}},\n\nWe have refunded {{amount}}. It usually reaches your account in 5 to 7 working days.\n\n{{org}}' },
  'subscription.cancelled': { subject: 'Your recurring donation has stopped', body: 'Dear {{name}},\n\nYour recurring donation of {{amount}} has been cancelled. Thank you for your support.\n\n{{org}}' },
  'volunteer.welcome': { subject: 'Welcome to the {{org}} volunteer team', body: 'Hello {{name}},\n\nYour volunteer application has been approved. See open shifts here:\n{{link}}' },
  'shift.assigned': { subject: 'You are signed up: {{title}}', body: 'Hello {{name}},\n\nYou are signed up for {{title}} on {{when}} at {{where}}.' },
  'shift.reminder': { subject: 'Reminder: {{title}} tomorrow', body: 'Hello {{name}},\n\nA reminder that {{title}} is on {{when}} at {{where}}.' },
  'beneficiary.decision': { subject: 'Your application to {{org}}', body: 'Hello {{name}},\n\nYour application status is now: {{status}}.' },
  'event.registered': { subject: 'Your place at {{title}}', body: 'Hello {{name}},\n\nYour status for {{title}} on {{when}} is: {{status}}.\nTicket code: {{code}}' },
  'assignment.graded': { subject: 'Marks for {{title}}', body: 'Hello {{name}},\n\nYour work on {{title}} has been marked: {{score}}.\n\n{{feedback}}' },
  'newsletter.confirm': { subject: 'Confirm your subscription', body: 'Please confirm you want updates from {{org}}:\n{{link}}' },
  'contact.received': { subject: 'New message from {{name}}', body: '{{name}} ({{email}}) wrote:\n\n{{message}}' },
  'report.ready': { subject: '{{report}} report for {{org}}', body: 'Your scheduled {{report}} report for {{org}} is ready. For privacy it is not attached. Sign in to download it:\n{{link}}' }
};

export const render = (text: string, vars: Record<string, unknown>): string =>
  text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const toHtml = (text: string): string =>
  `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1c2b22;max-width:560px;margin:auto;padding:24px">${esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</body></html>`;
