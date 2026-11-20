'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('../server/db');
const { createApp } = require('../server/app');
const { seed, PASSWORD } = require('../server/seed');

let server;
let base;
let ids;
let db;
const today = () => new Date().toISOString().slice(0, 10);
// 1x1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.before(async () => {
  db = openDb(':memory:');
  ids = seed(db);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakinah-'));
  server = http.createServer(createApp({ db, uploadDir: dir, publicDir: path.join(__dirname, '..', 'public') }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function client(username) {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Sakinah': '1', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, data: type.includes('json') ? await res.json() : null };
  };
  if (username) {
    const r = await call('POST', '/api/auth/login', { username, password: PASSWORD });
    assert.equal(r.status, 200, `login ${username}`);
  }
  return call;
}

const authorsOf = (posts) => new Set(posts.map((p) => p.author.username));
const SISTERS = ['sara_m', 'amina_h', 'noor_a', 'ustadha_fatimah', 'mod_sisters'];
const BROTHERS = ['omar_k', 'hamza_r', 'zaid_s', 'yahya_k', 'mod_brothers'];

test('brother feed: no sisters at all, except verified sister news', async () => {
  const omar = await client('omar_k');
  for (const tab of ['foryou', 'following', 'knowledge', 'duas', 'questions', 'news']) {
    const { data } = await omar('GET', `/api/feed?tab=${tab}`);
    const authors = authorsOf(data.posts);
    for (const s of SISTERS) assert.ok(!authors.has(s), `${tab} leaked ${s}`);
  }
  const all = authorsOf((await omar('GET', '/api/feed?tab=foryou')).data.posts);
  assert.ok(all.has('sisters_news'), 'sister-presented news is visible to brothers');
  assert.ok(all.has('ummah_news'));
  assert.ok(all.has('hamza_r'));
});

test('sister feed: no brothers at all, except verified news and scholars', async () => {
  const sara = await client('sara_m');
  const authors = authorsOf((await sara('GET', '/api/feed?tab=foryou')).data.posts);
  for (const b of BROTHERS) assert.ok(!authors.has(b), `leaked ${b}`);
  assert.ok(authors.has('ustadh_ahmad'), 'male scholar visible to sisters');
  assert.ok(authors.has('brothers_news'), 'male-presented news visible to sisters');
  assert.ok(authors.has('amina_h'));
});

test('comments and reaction counts are segregated on shared posts', async () => {
  const omar = await client('omar_k');
  const sara = await client('sara_m');
  const feed = (await omar('GET', '/api/feed?tab=knowledge')).data.posts;
  const post = feed.find((p) => p.author.username === 'ustadh_ahmad' && p.body.startsWith('Before you open'));
  const asOmar = (await omar('GET', `/api/posts/${post.id}`)).data;
  const asSara = (await sara('GET', `/api/posts/${post.id}`)).data;
  assert.deepEqual(asOmar.comments.map((c) => c.author.username), ['omar_k']);
  assert.deepEqual(asSara.comments.map((c) => c.author.username), ['sara_m']);
  assert.equal(asOmar.post.reactions.jazakallah, 3, 'brothers count only brothers');
  assert.equal(asSara.post.reactions.jazakallah, 2, 'sisters count only sisters');
});

test('opposite-gender profiles, posts and search results do not exist', async () => {
  const omar = await client('omar_k');
  assert.equal((await omar('GET', '/api/users/sara_m')).status, 404);
  assert.equal((await omar('GET', '/api/users/ustadha_fatimah')).status, 404);
  assert.equal((await omar('GET', '/api/users/sisters_news')).status, 200);
  const sara = await client('sara_m');
  assert.equal((await sara('GET', '/api/users/omar_k')).status, 404);
  assert.equal((await sara('GET', '/api/users/ustadh_ahmad')).status, 200);
  const sistersPost = (await sara('GET', '/api/feed?tab=duas')).data.posts.find((p) => p.author.username === 'sara_m');
  assert.equal((await omar('GET', `/api/posts/${sistersPost.id}`)).status, 404);
  assert.equal((await omar('POST', `/api/posts/${sistersPost.id}/react`, { type: 'ameen' })).status, 404);
  assert.equal((await omar('POST', `/api/posts/${sistersPost.id}/comments`, { body: 'hi' })).status, 404);
  const search = (await omar('GET', '/api/search?q=a')).data;
  for (const u of search.users) assert.ok(!SISTERS.includes(u.username));
  for (const p of search.posts) assert.ok(!SISTERS.includes(p.author.username));
  const follow = await omar('POST', '/api/users/amina_h/follow');
  assert.equal(follow.status, 404);
});

test('DMs between brothers and sisters are impossible', async () => {
  const omar = await client('omar_k');
  const sara = await client('sara_m');
  assert.equal((await omar('POST', '/api/messages/sara_m', { body: 'salam' })).status, 404);
  assert.equal((await sara('POST', '/api/messages/omar_k', { body: 'salam' })).status, 404);
  assert.equal((await sara('POST', '/api/messages/ustadh_ahmad', { body: 'question' })).status, 403);
  assert.equal((await omar('GET', '/api/messages/sara_m')).status, 404);
  assert.equal((await omar('POST', '/api/messages/hamza_r', { body: 'Wa alaykum salam akhi' })).status, 200);
  const convs = (await omar('GET', '/api/conversations')).data.conversations;
  for (const c of convs) assert.ok(BROTHERS.includes(c.user.username) || c.user.username === 'zaid_s');
});

test('circles are invisible across genders', async () => {
  const omar = await client('omar_k');
  const sara = await client('sara_m');
  const brothersCircles = (await omar('GET', '/api/circles')).data.circles;
  const sistersCircles = (await sara('GET', '/api/circles')).data.circles;
  assert.ok(brothersCircles.every((c) => !sistersCircles.some((s) => s.id === c.id)));
  assert.equal((await omar('GET', `/api/circles/${sistersCircles[0].id}`)).status, 404);
  assert.equal((await omar('POST', `/api/circles/${sistersCircles[0].id}/join`)).status, 404);
});

test('images are held for a same-gender moderator and served only to allowed viewers', async () => {
  const amina = await client('amina_h');
  const created = (await amina('POST', '/api/posts', { body: 'My new garden', image: PNG, imagePledge: true })).data.post;
  assert.equal(created.status, 'pending');
  const omar = await client('omar_k');
  const modB = await client('mod_brothers');
  const modS = await client('mod_sisters');
  assert.ok(!(await modB('GET', '/api/mod/queue')).data.pending.some((p) => p.id === created.id), 'male moderator never sees it');
  assert.ok((await modS('GET', '/api/mod/queue')).data.pending.some((p) => p.id === created.id));
  assert.equal((await modB('POST', `/api/mod/posts/${created.id}`, { action: 'approve' })).status, 404);
  assert.equal((await modS('POST', `/api/mod/posts/${created.id}`, { action: 'approve' })).status, 200);
  const imgUrl = created.image;
  const sara = await client('sara_m');
  assert.equal((await sara('GET', imgUrl)).status, 200);
  assert.equal((await omar('GET', imgUrl)).status, 404, 'brother cannot fetch a sister image even with the URL');
  assert.equal((await (await client())('GET', imgUrl)).status, 401);
});

test('haram content is rejected; contact details go to review', async () => {
  const hamza = await client('hamza_r');
  assert.equal((await hamza('POST', '/api/posts', { body: 'Check out this casino bonus' })).status, 422);
  const r = await hamza('POST', '/api/posts', { body: 'Add me on snapchat @hamza_r_99' });
  assert.equal(r.data.post.status, 'pending');
  assert.equal((await hamza('POST', '/api/posts', { body: 'Breaking!', category: 'news' })).status, 400, 'members cannot post as news');
});

test('gender cannot be changed after signup', async () => {
  const anon = await client();
  const s = await anon('POST', '/api/auth/signup', { username: 'new_bro', password: 'longpassword', displayName: 'New Brother', gender: 'male', birthYear: 1995, pledge: true });
  assert.equal(s.status, 200);
  await anon('PATCH', '/api/me', { gender: 'female', kind: 'news', verified: true });
  const me = (await anon('GET', '/api/me')).data.user;
  assert.equal(me.gender, 'male');
  assert.equal(me.kind, 'member');
  assert.equal(me.verified, false);
});

test('children: signup blocked, parent approval, time limit, DM restrictions', async () => {
  const anon = await client();
  const kid = await anon('POST', '/api/auth/signup', { username: 'kid1', password: 'longpassword', displayName: 'Kid', gender: 'male', birthYear: new Date().getUTCFullYear() - 10, pledge: true });
  assert.equal(kid.status, 403);

  const yahya = await client('yahya_k');
  const omar = await client('omar_k');
  const p = (await yahya('POST', '/api/posts', { body: 'I finished my homework!' })).data.post;
  assert.equal(p.status, 'guardian');
  const hamza = await client('hamza_r');
  assert.equal((await hamza('GET', `/api/posts/${p.id}`)).status, 404);
  const fam = (await omar('GET', '/api/family')).data;
  assert.ok(fam.children[0].pending.some((x) => x.id === p.id));
  assert.equal((await hamza('POST', `/api/family/posts/${p.id}/approve`)).status, 404, 'only the guardian can approve');
  assert.equal((await omar('POST', `/api/family/posts/${p.id}/approve`)).status, 200);
  assert.equal((await hamza('GET', `/api/posts/${p.id}`)).status, 200);

  assert.equal((await hamza('POST', '/api/messages/yahya_k', { body: 'salam' })).status, 403, 'child DMs off by default');
  const child = fam.children[0];
  await omar('PATCH', `/api/family/children/${child.id}`, { dmsEnabled: true, dailyLimitMin: 1 });
  assert.equal((await hamza('POST', '/api/messages/yahya_k', { body: 'salam' })).status, 403, 'needs mutual follow');
  assert.equal((await omar('POST', '/api/messages/yahya_k', { body: 'Dinner is ready' })).status, 200, 'guardian can message');
  assert.equal((await hamza('GET', '/api/search?q=yahya')).data.users.length, 0, 'children are not searchable');

  // time limit (1 minute): simulate the minute being used up
  await yahya('POST', '/api/me/ping', { day: today() });
  assert.equal((await yahya('GET', '/api/feed')).status, 200);
  db.prepare('UPDATE screen_time SET seconds = 60 WHERE user_id = ?').run(ids.yahya_k);
  const locked = await yahya('GET', '/api/feed');
  assert.equal(locked.status, 423);
  assert.equal(locked.data.locked, true);
  assert.equal((await yahya('GET', `/api/deeds?day=${today()}`)).status, 200, 'Deen tools stay open');
  assert.equal((await yahya('PATCH', '/api/me', { dailyLimitMin: 0 })).status, 403, 'child cannot lift own limit');
});

test('deeds and streaks are private and work', async () => {
  const zaid = await client('zaid_s');
  const r = (await zaid('POST', '/api/deeds', { day: today(), key: 'fajr', done: true })).data;
  assert.equal(r.done.fajr, 1);
  assert.equal(r.streak, 1);
  const t = (await zaid('POST', '/api/deeds', { day: today(), key: 'tasbih', add: 99 })).data;
  assert.equal(t.tasbih, 99);
  assert.equal(t.hasanatToday, 10 + 3);
});

test('state-changing requests require the CSRF header', async () => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'omar_k', password: PASSWORD }) });
  assert.equal(res.status, 403);
});
