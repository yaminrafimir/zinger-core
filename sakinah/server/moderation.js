'use strict';
/**
 * Text screening. Three outcomes:
 *   reject — clearly haram or abusive content, never published
 *   review — held for a same-gender moderator (e.g. sharing off-platform contact
 *            details, which could be used to get around segregation)
 *   allow
 *
 * Keyword lists are a first line of defence only; reports and moderators are the
 * second. Swap in a proper classifier for production (see README).
 */

const REJECT_TERMS = [
  // profanity / abuse
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'slut', 'whore',
  'motherfucker', 'asshole', 'wanker',
  // sexual content
  'porn', 'porno', 'pornhub', 'xxx', 'nude', 'nudes', 'naked', 'onlyfans', 'sexting', 'hookup', 'hook up',
  'camgirl', 'escort',
  // gambling and intoxicant promotion
  'casino', 'bet365', 'betting tips', 'sports betting', 'place your bets', 'slot machine', 'jackpot',
  'happy hour', 'drink up', 'get drunk', 'get high',
  // free mixing / dating solicitation
  'dating app', 'tinder', 'bumble', 'sugar daddy', 'girlfriend wanted', 'boyfriend wanted',
  // takfir / hate
  'kuffar must die',
];

const REVIEW_PATTERNS = [
  {
    // 10+ digits in one run of digits/spaces/dashes — dates and ayah refs stay well under that
    test: (t) => (t.match(/\+?\d[\d\s().-]{8,}\d/g) || []).some((m) => m.replace(/\D/g, '').length >= 10),
    reason: 'Looks like a phone number',
  },
  { re: /\b(snap(chat)?|insta(gram)?|whats ?app|telegram|tiktok|kik|discord)\b\s*[:@-]?\s*@?\w{3,}/i, reason: 'Off-platform contact handle' },
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/, reason: 'Email address' },
  { re: /\bhttps?:\/\/(?!(quran\.com|sunnah\.com|www\.islamqa\.info|islamqa\.info)\b)/i, reason: 'External link' },
];

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[0@4]/g, (c) => ({ 0: 'o', '@': 'a', 4: 'a' }[c]))
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/\$|5/g, 's')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

const rejectRe = new RegExp(
  `(^|\\s)(${REJECT_TERMS.map((t) => t.replace(/\s+/g, '\\s+')).join('|')})(?=\\s|$)`,
  'i'
);

function screenText(text) {
  const raw = String(text || '');
  const norm = ` ${normalise(raw)} `;
  if (rejectRe.test(norm) || rejectRe.test(` ${raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `)) {
    return {
      action: 'reject',
      reasons: ['This contains words or topics that are not allowed on Sakinah. Please keep it clean and beneficial.'],
    };
  }
  const reasons = REVIEW_PATTERNS.filter((p) => (p.test ? p.test(raw) : p.re.test(raw))).map((p) => p.reason);
  if (reasons.length) return { action: 'review', reasons };
  return { action: 'allow', reasons: [] };
}

module.exports = { screenText, normalise };
