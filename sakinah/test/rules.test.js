'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../server/db');
const rules = require('../server/rules');
const { screenText } = require('../server/moderation');

const u = (id, gender, kind = 'member', verified = 0) => ({ id, gender, kind, verified });
const brother = u(1, 'male');
const sister = u(2, 'female');
const people = [
  brother, sister, u(3, 'male'), u(4, 'female'),
  u(5, 'male', 'scholar', 1), u(6, 'female', 'scholar', 1),
  u(7, 'male', 'news', 1), u(8, 'female', 'news', 1),
  u(9, 'none', 'news', 1), u(10, 'male', 'scholar', 0), u(11, 'female', 'news', 0),
  u(12, 'male', 'moderator', 1), u(13, 'female', 'moderator', 1),
];

test('brothers never see sisters except verified news', () => {
  for (const a of people) {
    const expected = a.id === 1 || a.gender === 'male' || a.gender === 'none' || (a.gender === 'female' && a.kind === 'news' && a.verified);
    assert.equal(rules.canSeeAuthor(brother, a), !!expected, `brother -> ${JSON.stringify(a)}`);
  }
  assert.equal(rules.canSeeAuthor(brother, u(6, 'female', 'scholar', 1)), false, 'female scholar hidden from brothers');
});

test('sisters never see brothers except verified news and scholars', () => {
  for (const a of people) {
    const expected = a.id === 2 || a.gender === 'female' || a.gender === 'none'
      || (a.gender === 'male' && a.verified && (a.kind === 'news' || a.kind === 'scholar'));
    assert.equal(rules.canSeeAuthor(sister, a), !!expected, `sister -> ${JSON.stringify(a)}`);
  }
  assert.equal(rules.canSeeAuthor(sister, u(10, 'male', 'scholar', 0)), false, 'unverified "scholar" hidden');
  assert.equal(rules.canSeeAuthor(sister, u(12, 'male', 'moderator', 1)), false, 'male moderator hidden');
});

test('SQL filter matches canSeeAuthor for every viewer/author pair', () => {
  const db = openDb(':memory:');
  const ins = db.prepare("INSERT INTO users (id, username, display_name, password_hash, gender, kind, verified, created_at) VALUES (?,?,?,?,?,?,?,0)");
  for (const p of people) ins.run(p.id, `user${p.id}`, `U${p.id}`, 'x', p.gender, p.kind, p.verified);
  for (const viewer of people) {
    const visible = new Set(db.prepare(`SELECT id FROM users u WHERE ${rules.visibleAuthorSql(viewer, 'u')}`).all().map((r) => r.id));
    for (const author of people) {
      assert.equal(visible.has(author.id), rules.canSeeAuthor(viewer, author), `viewer ${viewer.id} author ${author.id}`);
    }
  }
});

test('DMs are same-gender only and never with news channels', () => {
  assert.equal(rules.canMessage(brother, u(3, 'male')), true);
  assert.equal(rules.canMessage(sister, u(4, 'female')), true);
  for (const other of people) {
    if (other.gender !== brother.gender) assert.equal(rules.canMessage(brother, other), false);
    if (other.gender !== sister.gender) assert.equal(rules.canMessage(sister, other), false);
  }
  assert.equal(rules.canMessage(sister, u(8, 'female', 'news', 1)), false);
  assert.equal(rules.canMessage(brother, brother), false);
});

test('circles and moderation are single-gender', () => {
  assert.equal(rules.canAccessCircle(brother, { gender: 'male' }), true);
  assert.equal(rules.canAccessCircle(brother, { gender: 'female' }), false);
  assert.equal(rules.canAccessCircle(sister, { gender: 'male' }), false);
  assert.equal(rules.canModerate(u(12, 'male', 'moderator', 1), sister), false);
  assert.equal(rules.canModerate(u(13, 'female', 'moderator', 1), sister), true);
  assert.equal(rules.canModerate(brother, brother), false);
});

test('database refuses presenter-less accounts that are not verified channels', () => {
  const db = openDb(':memory:');
  assert.throws(() => db.prepare("INSERT INTO users (username, display_name, password_hash, gender, kind, verified, created_at) VALUES ('x','x','x','none','member',0,0)").run());
});

test('content screening', () => {
  assert.equal(screenText('JazakAllah khair for the reminder').action, 'allow');
  assert.equal(screenText('Quran 2:286 on 2026-11-20').action, 'allow');
  assert.equal(screenText('this is sh1t').action, 'reject');
  assert.equal(screenText('free p0rn here').action, 'reject');
  assert.equal(screenText('best casino bonus').action, 'reject');
  assert.equal(screenText('add me on snapchat @brother123').action, 'review');
  assert.equal(screenText('call 0300 123 4567').action, 'review');
  assert.equal(screenText('read https://quran.com/67').action, 'allow');
  assert.equal(screenText('see https://example.com').action, 'review');
});
