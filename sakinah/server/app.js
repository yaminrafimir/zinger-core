'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const rules = require('./rules');
const { screenText } = require('./moderation');
const { DEEDS, dailyFor } = require('./content');

const REACTIONS = ['mashallah', 'jazakallah', 'subhanallah', 'ameen'];
const MEMBER_CATEGORIES = ['general', 'reminder', 'quran', 'hadith', 'dua', 'question', 'family'];
const CHILD_AGE = 16;
const PAGE = 20;
const MAX_BODY = 4 * 1024 * 1024;
const MAX_IMAGE = 2.5 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

// ---------- password + session helpers ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

function isDay(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
function serverDay(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}
/** Client-local days are accepted within one day of server UTC (time zones). */
function checkDay(day) {
  if (!isDay(day)) fail(400, 'Invalid day');
  if (![serverDay(-1), serverDay(0), serverDay(1)].includes(day)) fail(400, 'Day out of range');
  return day;
}
function prevDay(day) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}

function str(v, { min = 0, max = 2000, name = 'Field' } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min) fail(400, `${name} is required`);
  if (s.length > max) fail(400, `${name} is too long (max ${max} characters)`);
  return s;
}

function ageOf(user) {
  return user.birth_year ? new Date().getUTCFullYear() - user.birth_year : 99;
}
const isChild = (u) => !!u.guardian_id;

// ---------- images ----------
const MAGIC = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
};
const MIME = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function createApp({ db, uploadDir, publicDir }) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const stmts = new Map();
  const q = (sql) => {
    let s = stmts.get(sql);
    if (!s) { s = db.prepare(sql); stmts.set(sql, s); }
    return s;
  };
  const get = (sql, ...p) => q(sql).get(...p);
  const all = (sql, ...p) => q(sql).all(...p);
  const run = (sql, ...p) => q(sql).run(...p);
  const now = () => Date.now();
  const placeholders = (n) => new Array(n).fill('?').join(',');

  const userById = (id) => get('SELECT * FROM users WHERE id = ?', id);
  const userByName = (name) => get('SELECT * FROM users WHERE username = ?', String(name || ''));

  function publicUser(u) {
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      kind: u.kind,
      verified: !!u.verified,
      avatarHue: u.avatar_hue,
      bio: u.bio,
      isChild: !!u.guardian_id,
      isChannel: u.kind === 'news' || u.kind === 'scholar',
    };
  }
  function meUser(u) {
    return {
      ...publicUser(u),
      gender: u.gender,
      dmsEnabled: !!u.dms_enabled,
      dailyLimitMin: u.daily_limit_min,
      salahPause: !!u.salah_pause,
      isModerator: u.kind === 'moderator',
      hasChildren: !!get('SELECT 1 FROM users WHERE guardian_id = ? LIMIT 1', u.id),
      birthYear: u.birth_year,
    };
  }

  // ---------- notifications (never across the segregation line) ----------
  function notify(targetId, actor, type, postId, text = '') {
    if (!actor || targetId === actor.id) return;
    const target = userById(targetId);
    if (!target || !rules.canSeeAuthor(target, actor)) return;
    run('INSERT INTO notifications (user_id, actor_id, type, post_id, text, created_at) VALUES (?,?,?,?,?,?)',
      targetId, actor.id, type, postId || null, text.slice(0, 140), now());
  }

  // ---------- screen time / child limits ----------
  function secondsToday(user) {
    const row = get('SELECT day, seconds FROM screen_time WHERE user_id = ? ORDER BY day DESC LIMIT 1', user.id);
    if (!row || row.day < serverDay(-1)) return 0;
    return row.seconds;
  }
  function assertNotTimeLocked(user) {
    if (isChild(user) && user.daily_limit_min > 0 && secondsToday(user) >= user.daily_limit_min * 60) {
      fail(423, "Your time for today is up. Your Deen tab is still open — and there's always Qur'an! 🌙", { locked: true });
    }
  }

  // ---------- posts ----------
  const POST_SELECT = `SELECT p.*, u.username, u.display_name, u.kind, u.verified, u.avatar_hue, u.gender,
      u.bio, u.guardian_id FROM posts p JOIN users u ON u.id = p.author_id`;

  function authorOf(row) {
    return {
      id: row.author_id, username: row.username, display_name: row.display_name, kind: row.kind,
      verified: row.verified, avatar_hue: row.avatar_hue, gender: row.gender, bio: row.bio, guardian_id: row.guardian_id,
    };
  }

  function enrichPosts(viewer, rows) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const ph = placeholders(ids.length);
    const vis = rules.visibleAuthorSql(viewer, 'ru');
    const counts = {};
    for (const r of all(`SELECT r.post_id, r.type, COUNT(*) AS c FROM reactions r JOIN users ru ON ru.id = r.user_id
        WHERE r.post_id IN (${ph}) AND ${vis} GROUP BY r.post_id, r.type`, ...ids)) {
      (counts[r.post_id] ||= {})[r.type] = r.c;
    }
    const mine = {};
    for (const r of all(`SELECT post_id, type FROM reactions WHERE user_id = ? AND post_id IN (${ph})`, viewer.id, ...ids)) {
      (mine[r.post_id] ||= []).push(r.type);
    }
    const comments = {};
    for (const r of all(`SELECT c.post_id, COUNT(*) AS c FROM comments c JOIN users ru ON ru.id = c.author_id
        WHERE c.post_id IN (${ph}) AND c.status = 'published' AND ${vis} GROUP BY c.post_id`, ...ids)) {
      comments[r.post_id] = r.c;
    }
    const marks = new Set(all(`SELECT post_id FROM bookmarks WHERE user_id = ? AND post_id IN (${ph})`, viewer.id, ...ids)
      .map((r) => r.post_id));
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      category: r.category,
      image: r.image ? `/api/media/${r.image}` : null,
      status: r.status,
      reviewReason: r.status !== 'published' ? r.review_reason : undefined,
      circleId: r.circle_id,
      createdAt: r.created_at,
      author: publicUser(authorOf(r)),
      reactions: Object.fromEntries(REACTIONS.map((t) => [t, (counts[r.id] || {})[t] || 0])),
      myReactions: mine[r.id] || [],
      commentCount: comments[r.id] || 0,
      bookmarked: marks.has(r.id),
      isMine: r.author_id === viewer.id,
    }));
  }

  /** Load a post the viewer may see, or 404 — opposite-gender content simply does not exist. */
  function visiblePost(viewer, id, { allowOwnPending = true } = {}) {
    const row = get(`${POST_SELECT} WHERE p.id = ?`, Number(id));
    if (!row) fail(404, 'Post not found');
    const author = authorOf(row);
    if (!rules.canSeeAuthor(viewer, author)) fail(404, 'Post not found');
    if (row.circle_id) {
      const circle = get('SELECT * FROM circles WHERE id = ?', row.circle_id);
      if (!rules.canAccessCircle(viewer, circle)) fail(404, 'Post not found');
    }
    if (row.status !== 'published' && !(allowOwnPending && row.author_id === viewer.id)) fail(404, 'Post not found');
    return row;
  }

  function saveImage(dataUrl) {
    const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
    if (!m) fail(400, 'Images must be JPEG, PNG or WebP');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_IMAGE) fail(413, 'Image is too large (max 2.5 MB)');
    const type = m[1] === 'jpg' ? 'jpeg' : m[1];
    if (!MAGIC[type](buf)) fail(400, 'That file is not a valid image');
    const name = `${crypto.randomBytes(16).toString('hex')}.${type}`;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    return name;
  }

  function createPost(viewer, body) {
    assertNotTimeLocked(viewer);
    const text = str(body.body, { min: 1, max: 2000, name: 'Post' });
    let category = body.category || 'general';
    if (viewer.kind === 'news') category = 'news';
    else if (!MEMBER_CATEGORIES.includes(category)) fail(400, 'Choose a valid category');

    let circleId = null;
    if (body.circleId) {
      const circle = get('SELECT * FROM circles WHERE id = ?', Number(body.circleId));
      if (!rules.canAccessCircle(viewer, circle)) fail(404, 'Circle not found');
      if (!get('SELECT 1 FROM circle_members WHERE circle_id = ? AND user_id = ?', circle.id, viewer.id)) {
        fail(403, 'Join this circle to post in it');
      }
      circleId = circle.id;
    }

    const screen = screenText(text);
    if (screen.action === 'reject') fail(422, screen.reasons[0]);

    let status = 'published';
    let reason = null;
    if (screen.action === 'review') { status = 'pending'; reason = screen.reasons.join('; '); }

    let image = null;
    if (body.image) {
      if (!body.imagePledge) fail(400, 'Please confirm the image follows the image guidelines');
      image = saveImage(body.image);
      if (!viewer.trusted && !viewer.verified) {
        status = 'pending';
        reason = [reason, 'New image — checked by a moderator before it appears'].filter(Boolean).join('; ');
      }
    }
    if (isChild(viewer)) { status = 'guardian'; reason = 'Waiting for your parent to approve'; }

    const res = run('INSERT INTO posts (author_id, circle_id, body, category, image, status, review_reason, created_at) VALUES (?,?,?,?,?,?,?,?)',
      viewer.id, circleId, text, category, image, status, reason, now());
    const row = get(`${POST_SELECT} WHERE p.id = ?`, Number(res.lastInsertRowid));
    return enrichPosts(viewer, [row])[0];
  }

  function feed(viewer, tab, page) {
    assertNotTimeLocked(viewer);
    const vis = rules.visibleAuthorSql(viewer, 'u');
    const base = `${POST_SELECT} WHERE p.status = 'published' AND p.circle_id IS NULL AND ${vis}`;
    const offset = Math.max(0, page | 0) * PAGE;
    let rows;
    if (tab === 'foryou') {
      const since = now() - 30 * 86400000;
      const candidates = all(`${base} AND p.created_at > ? ORDER BY p.created_at DESC LIMIT 500`, since);
      const enriched = enrichPosts(viewer, candidates);
      const followed = new Set(all('SELECT followee_id FROM follows WHERE follower_id = ?', viewer.id).map((r) => r.followee_id));
      const scored = enriched.map((p) => {
        const reacts = Object.values(p.reactions).reduce((a, b) => a + b, 0);
        const ageH = (now() - p.createdAt) / 3600000;
        let boost = 1 + reacts + 2 * p.commentCount;
        if (followed.has(p.author.id)) boost += 8;
        if (p.author.kind === 'scholar' || ['quran', 'hadith', 'reminder'].includes(p.category)) boost += 3;
        return { p, score: boost / Math.pow(ageH + 2, 1.3) };
      }).sort((a, b) => b.score - a.score).map((x) => x.p);
      // gentle diversity: don't show the same author three times in a row
      const ordered = [];
      const rest = [...scored];
      while (rest.length) {
        const last2 = ordered.slice(-2).map((p) => p.author.id);
        let i = rest.findIndex((p) => !(last2.length === 2 && last2.every((id) => id === p.author.id)));
        if (i < 0) i = 0;
        ordered.push(rest.splice(i, 1)[0]);
      }
      const slice = ordered.slice(offset, offset + PAGE);
      return { posts: slice, hasMore: offset + PAGE < ordered.length };
    }
    const filters = {
      following: ['AND (p.author_id = ? OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))', [viewer.id, viewer.id]],
      knowledge: ["AND (u.kind = 'scholar' OR p.category IN ('quran','hadith','reminder'))", []],
      duas: ["AND p.category = 'dua'", []],
      questions: ["AND p.category = 'question'", []],
      news: ["AND (u.kind = 'news' OR p.category = 'news')", []],
      saved: ['AND p.id IN (SELECT post_id FROM bookmarks WHERE user_id = ?)', [viewer.id]],
    };
    const f = filters[tab];
    if (!f) fail(400, 'Unknown feed');
    rows = all(`${base} ${f[0]} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, ...f[1], PAGE + 1, offset);
    return { posts: enrichPosts(viewer, rows.slice(0, PAGE)), hasMore: rows.length > PAGE };
  }

  function commentsFor(viewer, postId) {
    const vis = rules.visibleAuthorSql(viewer, 'u');
    return all(`SELECT c.*, u.username, u.display_name, u.kind, u.verified, u.avatar_hue, u.gender, u.bio, u.guardian_id
        FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.post_id = ? AND c.status = 'published' AND ${vis} ORDER BY c.created_at ASC`, postId)
      .map((c) => ({ id: c.id, body: c.body, createdAt: c.created_at, author: publicUser(authorOf(c)), isMine: c.author_id === viewer.id }));
  }

  // ---------- streaks & hasanat ----------
  const DEED_POINTS = Object.fromEntries(DEEDS.map((d) => [d.key, d.points]));
  function deedSummary(user, day) {
    const done = Object.fromEntries(all('SELECT key, value FROM deeds WHERE user_id = ? AND day = ?', user.id, day)
      .map((r) => [r.key, r.value]));
    const days = new Set(all('SELECT DISTINCT day FROM deeds WHERE user_id = ? AND day <= ? ORDER BY day DESC LIMIT 400', user.id, day)
      .map((r) => r.day));
    let cursor = days.has(day) ? day : prevDay(day);
    let streak = 0;
    while (days.has(cursor)) { streak += 1; cursor = prevDay(cursor); }
    const points = (rows) => rows.reduce((sum, r) => sum + (r.key === 'tasbih' ? Math.floor(r.value / 33) : (DEED_POINTS[r.key] || 0)), 0);
    const todayRows = Object.entries(done).map(([key, value]) => ({ key, value }));
    const total = points(all('SELECT key, value FROM deeds WHERE user_id = ?', user.id));
    return { deeds: DEEDS, done, streak, hasanatToday: points(todayRows), hasanatTotal: total, tasbih: done.tasbih || 0 };
  }

  // ---------- routing ----------
  const routes = [];
  const route = (method, pattern, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, re, keys, handler, auth: opts.auth !== false });
  };

  const authHits = new Map();
  function rateLimit(ip) {
    const t = now();
    const hit = authHits.get(ip) || { n: 0, reset: t + 10 * 60000 };
    if (t > hit.reset) { hit.n = 0; hit.reset = t + 10 * 60000; }
    hit.n += 1;
    authHits.set(ip, hit);
    if (hit.n > 30) fail(429, 'Too many attempts. Please wait a few minutes.');
  }

  function startSession(ctx, user) {
    const token = crypto.randomBytes(32).toString('base64url');
    run('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?,?,?)', sha256(token), user.id, now());
    ctx.setCookie(`sk_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
  }

  function validateNewAccount(body) {
    const username = str(body.username, { min: 3, max: 20, name: 'Username' }).toLowerCase();
    if (!/^[a-z0-9_]+$/.test(username)) fail(400, 'Username can use letters, numbers and _ only');
    if (userByName(username)) fail(409, 'That username is taken');
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8) fail(400, 'Password must be at least 8 characters');
    const displayName = str(body.displayName, { min: 2, max: 40, name: 'Name' });
    if (screenText(displayName).action === 'reject' || screenText(username).action === 'reject') fail(422, 'Please choose a respectful name');
    if (!rules.GENDERS.includes(body.gender)) fail(400, 'Please choose Brother or Sister');
    const birthYear = Number(body.birthYear);
    const year = new Date().getUTCFullYear();
    if (!Number.isInteger(birthYear) || birthYear < year - 110 || birthYear > year - 5) fail(400, 'Enter a valid birth year');
    return { username, password, displayName, gender: body.gender, birthYear };
  }

  function insertUser(a, extra = {}) {
    const res = run(`INSERT INTO users (username, display_name, password_hash, gender, birth_year, avatar_hue, guardian_id,
        daily_limit_min, dms_enabled, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    a.username, a.displayName, hashPassword(a.password), a.gender, a.birthYear, crypto.randomInt(0, 360),
    extra.guardianId || null, extra.dailyLimitMin || 0, extra.dmsEnabled === false ? 0 : 1, now());
    return userById(Number(res.lastInsertRowid));
  }

  // --- auth
  route('POST', '/api/auth/signup', (ctx) => {
    rateLimit(ctx.ip);
    const a = validateNewAccount(ctx.body);
    if (!ctx.body.pledge) fail(400, 'Please accept the Sakinah adab pledge');
    if (new Date().getUTCFullYear() - a.birthYear < CHILD_AGE) {
      fail(403, `Under ${CHILD_AGE}? Ask your parent to create your account from the Family page of their Sakinah account.`);
    }
    const user = insertUser(a);
    startSession(ctx, user);
    return { user: meUser(user) };
  }, { auth: false });

  route('POST', '/api/auth/login', (ctx) => {
    rateLimit(ctx.ip);
    const user = userByName(ctx.body.username);
    if (!user || !verifyPassword(String(ctx.body.password || ''), user.password_hash)) fail(401, 'Wrong username or password');
    startSession(ctx, user);
    return { user: meUser(user) };
  }, { auth: false });

  route('POST', '/api/auth/logout', (ctx) => {
    if (ctx.token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(ctx.token));
    ctx.setCookie('sk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return { ok: true };
  }, { auth: false });

  // --- me
  route('GET', '/api/me', (ctx) => ({
    user: meUser(ctx.user),
    unread: {
      notifications: get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0', ctx.user.id).c,
      messages: get('SELECT COUNT(*) AS c FROM messages WHERE recipient_id = ? AND read_at IS NULL', ctx.user.id).c,
    },
    secondsToday: secondsToday(ctx.user),
  }));

  route('PATCH', '/api/me', (ctx) => {
    const u = ctx.user;
    const b = ctx.body;
    // gender, kind and verified are intentionally NOT editable.
    const displayName = b.displayName !== undefined ? str(b.displayName, { min: 2, max: 40, name: 'Name' }) : u.display_name;
    const bio = b.bio !== undefined ? str(b.bio, { max: 160, name: 'Bio' }) : u.bio;
    for (const t of [displayName, bio]) if (screenText(t).action !== 'allow') fail(422, 'Please keep your profile clean and free of contact details');
    const hue = b.avatarHue !== undefined ? Math.max(0, Math.min(359, Number(b.avatarHue) | 0)) : u.avatar_hue;
    const salah = b.salahPause !== undefined ? (b.salahPause ? 1 : 0) : u.salah_pause;
    let limit = u.daily_limit_min;
    if (b.dailyLimitMin !== undefined) {
      if (isChild(u)) fail(403, 'Your parent manages your time limit');
      limit = Math.max(0, Math.min(600, Number(b.dailyLimitMin) | 0));
    }
    run('UPDATE users SET display_name = ?, bio = ?, avatar_hue = ?, salah_pause = ?, daily_limit_min = ? WHERE id = ?',
      displayName, bio, hue, salah, limit, u.id);
    return { user: meUser(userById(u.id)) };
  });

  route('POST', '/api/me/ping', (ctx) => {
    const day = checkDay(ctx.body.day);
    const t = now();
    const row = get('SELECT * FROM screen_time WHERE user_id = ? AND day = ?', ctx.user.id, day);
    if (!row) run('INSERT INTO screen_time (user_id, day, seconds, last_ping) VALUES (?,?,?,?)', ctx.user.id, day, 0, t);
    else {
      const add = Math.min(60, Math.max(0, Math.round((t - row.last_ping) / 1000)));
      run('UPDATE screen_time SET seconds = seconds + ?, last_ping = ? WHERE user_id = ? AND day = ?', add, t, ctx.user.id, day);
    }
    const seconds = get('SELECT seconds FROM screen_time WHERE user_id = ? AND day = ?', ctx.user.id, day).seconds;
    const limit = ctx.user.daily_limit_min;
    return { seconds, limitMin: limit, locked: isChild(ctx.user) && limit > 0 && seconds >= limit * 60, overLimit: limit > 0 && seconds >= limit * 60 };
  });

  // --- feed & posts
  route('GET', '/api/feed', (ctx) => feed(ctx.user, ctx.query.get('tab') || 'foryou', Number(ctx.query.get('page') || 0)));
  route('POST', '/api/posts', (ctx) => ({ post: createPost(ctx.user, ctx.body) }));

  route('GET', '/api/posts/:id', (ctx) => {
    const row = visiblePost(ctx.user, ctx.params.id);
    return { post: enrichPosts(ctx.user, [row])[0], comments: commentsFor(ctx.user, row.id) };
  });

  route('DELETE', '/api/posts/:id', (ctx) => {
    const row = get('SELECT * FROM posts WHERE id = ?', Number(ctx.params.id));
    if (!row || row.author_id !== ctx.user.id) fail(404, 'Post not found');
    run('DELETE FROM posts WHERE id = ?', row.id);
    if (row.image) fs.rm(path.join(uploadDir, row.image), () => {});
    return { ok: true };
  });

  route('POST', '/api/posts/:id/react', (ctx) => {
    assertNotTimeLocked(ctx.user);
    const row = visiblePost(ctx.user, ctx.params.id, { allowOwnPending: false });
    const type = ctx.body.type;
    if (!REACTIONS.includes(type)) fail(400, 'Unknown reaction');
    const existing = get('SELECT 1 FROM reactions WHERE post_id = ? AND user_id = ? AND type = ?', row.id, ctx.user.id, type);
    if (existing) run('DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND type = ?', row.id, ctx.user.id, type);
    else {
      run('INSERT INTO reactions (post_id, user_id, type, created_at) VALUES (?,?,?,?)', row.id, ctx.user.id, type, now());
      notify(row.author_id, ctx.user, 'reaction', row.id, type);
    }
    return { post: enrichPosts(ctx.user, [row])[0] };
  });

  route('POST', '/api/posts/:id/bookmark', (ctx) => {
    const row = visiblePost(ctx.user, ctx.params.id, { allowOwnPending: false });
    const r = run('DELETE FROM bookmarks WHERE post_id = ? AND user_id = ?', row.id, ctx.user.id);
    if (!r.changes) run('INSERT INTO bookmarks (post_id, user_id, created_at) VALUES (?,?,?)', row.id, ctx.user.id, now());
    return { bookmarked: !r.changes };
  });

  route('POST', '/api/posts/:id/comments', (ctx) => {
    assertNotTimeLocked(ctx.user);
    const row = visiblePost(ctx.user, ctx.params.id, { allowOwnPending: false });
    const text = str(ctx.body.body, { min: 1, max: 600, name: 'Comment' });
    const screen = screenText(text);
    if (screen.action === 'reject') fail(422, screen.reasons[0]);
    if (screen.action === 'review') fail(422, 'Please keep contact details and outside links out of comments');
    run('INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)', row.id, ctx.user.id, text, now());
    notify(row.author_id, ctx.user, 'comment', row.id, text);
    return { comments: commentsFor(ctx.user, row.id) };
  });

  route('DELETE', '/api/comments/:id', (ctx) => {
    const c = get('SELECT * FROM comments WHERE id = ?', Number(ctx.params.id));
    if (!c || c.author_id !== ctx.user.id) fail(404, 'Comment not found');
    run('DELETE FROM comments WHERE id = ?', c.id);
    return { ok: true };
  });

  route('POST', '/api/report', (ctx) => {
    const reason = str(ctx.body.reason, { min: 2, max: 300, name: 'Reason' });
    let postId = null;
    let commentId = null;
    if (ctx.body.commentId) {
      const c = get('SELECT c.*, u.gender, u.kind, u.verified FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?', Number(ctx.body.commentId));
      if (!c || !rules.canSeeAuthor(ctx.user, { id: c.author_id, gender: c.gender, kind: c.kind, verified: c.verified })) fail(404, 'Not found');
      commentId = c.id;
    } else {
      postId = visiblePost(ctx.user, ctx.body.postId, { allowOwnPending: false }).id;
    }
    run('INSERT INTO reports (reporter_id, post_id, comment_id, reason, created_at) VALUES (?,?,?,?,?)', ctx.user.id, postId, commentId, reason, now());
    if (postId) {
      const n = get("SELECT COUNT(DISTINCT reporter_id) AS c FROM reports WHERE post_id = ? AND status = 'open'", postId).c;
      if (n >= 3) run("UPDATE posts SET status = 'pending', review_reason = 'Reported by the community' WHERE id = ?", postId);
    }
    return { ok: true, message: 'JazakAllah khair. A moderator will review this.' };
  });

  // --- media: served only to viewers allowed to see the author
  route('GET', '/api/media/:file', (ctx) => {
    const file = ctx.params.file;
    if (!/^[a-f0-9]{32}\.(jpeg|png|webp)$/.test(file)) fail(404, 'Not found');
    const row = get(`${POST_SELECT} WHERE p.image = ?`, file);
    if (!row) fail(404, 'Not found');
    const author = authorOf(row);
    const viewer = ctx.user;
    const privileged = row.author_id === viewer.id
      || (rules.canModerate(viewer, author))
      || (row.guardian_id && row.guardian_id === viewer.id);
    if (!privileged) visiblePost(viewer, row.id, { allowOwnPending: false });
    const ext = file.split('.').pop();
    ctx.sendFile(path.join(uploadDir, file), MIME[ext], { 'Cache-Control': 'private, max-age=3600' });
  });

  // --- daily content
  route('GET', '/api/daily', (ctx) => {
    const day = isDay(ctx.query.get('day')) ? ctx.query.get('day') : serverDay();
    return dailyFor(day);
  });

  // --- users
  route('GET', '/api/users/:username', (ctx) => {
    const target = userByName(ctx.params.username);
    if (!target || !rules.canSeeAuthor(ctx.user, target)) fail(404, 'User not found');
    const vis = rules.visibleAuthorSql(ctx.user, 'u');
    const followers = get(`SELECT COUNT(*) AS c FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ? AND ${vis}`, target.id).c;
    const following = get(`SELECT COUNT(*) AS c FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? AND ${vis}`, target.id).c;
    const rows = all(`${POST_SELECT} WHERE p.author_id = ? AND p.circle_id IS NULL AND (p.status = 'published' OR p.author_id = ?)
        ORDER BY p.created_at DESC LIMIT 50`, target.id, ctx.user.id);
    return {
      user: publicUser(target),
      stats: { followers, following, posts: rows.filter((r) => r.status === 'published').length },
      isFollowing: !!get('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', ctx.user.id, target.id),
      canMessage: rules.canMessage(ctx.user, target),
      posts: enrichPosts(ctx.user, rows),
    };
  });

  route('POST', '/api/users/:username/follow', (ctx) => {
    const target = userByName(ctx.params.username);
    if (!target || !rules.canSeeAuthor(ctx.user, target)) fail(404, 'User not found');
    if (!rules.canFollow(ctx.user, target)) fail(400, 'You cannot follow this account');
    const r = run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', ctx.user.id, target.id);
    if (!r.changes) {
      run('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)', ctx.user.id, target.id, now());
      notify(target.id, ctx.user, 'follow', null);
    }
    return { following: !r.changes };
  });

  route('GET', '/api/search', (ctx) => {
    const term = str(ctx.query.get('q') || '', { max: 60, name: 'Search' });
    if (term.length < 2) return { users: [], posts: [] };
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const vis = rules.visibleAuthorSql(ctx.user, 'u');
    // Children are not discoverable through search, except by their own guardian.
    const users = all(`SELECT * FROM users u WHERE (u.username LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\')
        AND ${vis} AND (u.guardian_id IS NULL OR u.guardian_id = ?) LIMIT 20`, like, like, ctx.user.id).map(publicUser);
    const posts = enrichPosts(ctx.user, all(`${POST_SELECT} WHERE p.status = 'published' AND p.circle_id IS NULL AND ${vis}
        AND p.body LIKE ? ESCAPE '\\' ORDER BY p.created_at DESC LIMIT 20`, like));
    return { users, posts };
  });

  route('GET', '/api/suggestions', (ctx) => {
    const vis = rules.visibleAuthorSql(ctx.user, 'u');
    const users = all(`SELECT u.*, (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS fc FROM users u
        WHERE ${vis} AND u.id <> ? AND u.guardian_id IS NULL
        AND u.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = ?)
        ORDER BY u.verified DESC, fc DESC LIMIT 6`, ctx.user.id, ctx.user.id);
    return { users: users.map(publicUser) };
  });

  // --- messages (same gender only — no exceptions)
  function assertCanDm(a, b) {
    if (!b || !rules.canSeeAuthor(a, b)) fail(404, 'User not found');
    if (!rules.canMessage(a, b)) fail(403, 'Messaging is only available between brothers or between sisters');
    for (const [x, y] of [[a, b], [b, a]]) {
      if (isChild(x)) {
        if (!x.dms_enabled) fail(403, x.id === a.id ? 'Your parent has turned off messages' : 'This account cannot receive messages');
        const mutual = get('SELECT 1 FROM follows f1 JOIN follows f2 ON f2.follower_id = f1.followee_id AND f2.followee_id = f1.follower_id WHERE f1.follower_id = ? AND f1.followee_id = ?', x.id, y.id);
        if (!mutual && x.guardian_id !== y.id) fail(403, 'Young members can only message people they both follow');
      }
    }
  }

  route('GET', '/api/conversations', (ctx) => {
    assertNotTimeLocked(ctx.user);
    const me = ctx.user.id;
    const rows = all(`SELECT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS other, MAX(created_at) AS last
        FROM messages WHERE sender_id = ? OR recipient_id = ? GROUP BY other ORDER BY last DESC LIMIT 100`, me, me, me);
    const out = [];
    for (const r of rows) {
      const other = userById(r.other);
      if (!other || !rules.canMessage(ctx.user, other)) continue;
      const last = get('SELECT * FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY created_at DESC LIMIT 1', me, other.id, other.id, me);
      const unread = get('SELECT COUNT(*) AS c FROM messages WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL', other.id, me).c;
      out.push({ user: publicUser(other), last: { body: last.body, createdAt: last.created_at, fromMe: last.sender_id === me }, unread });
    }
    return { conversations: out };
  });

  route('GET', '/api/messages/:username', (ctx) => {
    assertNotTimeLocked(ctx.user);
    const other = userByName(ctx.params.username);
    if (!other || !rules.canMessage(ctx.user, other)) fail(404, 'User not found');
    const me = ctx.user.id;
    run('UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL', now(), other.id, me);
    const messages = all(`SELECT * FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
        ORDER BY created_at ASC LIMIT 500`, me, other.id, other.id, me)
      .map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at, fromMe: m.sender_id === me }));
    let canSend = true;
    let blockedReason = null;
    try { assertCanDm(ctx.user, other); } catch (e) { canSend = false; blockedReason = e.message; }
    return { user: publicUser(other), messages, canSend, blockedReason };
  });

  route('POST', '/api/messages/:username', (ctx) => {
    assertNotTimeLocked(ctx.user);
    const other = userByName(ctx.params.username);
    assertCanDm(ctx.user, other);
    const text = str(ctx.body.body, { min: 1, max: 1000, name: 'Message' });
    const screen = screenText(text);
    if (screen.action === 'reject') fail(422, screen.reasons[0]);
    if (screen.action === 'review' && (isChild(ctx.user) || isChild(other))) fail(422, 'Contact details and links cannot be shared with young members');
    run('INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES (?,?,?,?)', ctx.user.id, other.id, text, now());
    return { ok: true };
  });

  // --- notifications
  route('GET', '/api/notifications', (ctx) => {
    const rows = all(`SELECT n.*, u.username, u.display_name, u.kind, u.verified, u.avatar_hue, u.gender, u.bio, u.guardian_id
        FROM notifications n LEFT JOIN users u ON u.id = n.actor_id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 60`, ctx.user.id);
    return {
      notifications: rows
        .filter((n) => !n.actor_id || rules.canSeeAuthor(ctx.user, { id: n.actor_id, gender: n.gender, kind: n.kind, verified: n.verified }))
        .map((n) => ({
          id: n.id, type: n.type, postId: n.post_id, text: n.text, createdAt: n.created_at, read: !!n.read,
          actor: n.actor_id ? publicUser({ ...n, id: n.actor_id }) : null,
        })),
    };
  });
  route('POST', '/api/notifications/read', (ctx) => {
    run('UPDATE notifications SET read = 1 WHERE user_id = ?', ctx.user.id);
    return { ok: true };
  });

  // --- circles (halaqahs) — single-gender spaces
  function circleOut(viewer, c) {
    return {
      id: c.id, name: c.name, description: c.description, emoji: c.emoji,
      members: get('SELECT COUNT(*) AS c FROM circle_members WHERE circle_id = ?', c.id).c,
      joined: !!get('SELECT 1 FROM circle_members WHERE circle_id = ? AND user_id = ?', c.id, viewer.id),
      isOwner: c.created_by === viewer.id,
    };
  }
  route('GET', '/api/circles', (ctx) => {
    if (!rules.GENDERS.includes(ctx.user.gender)) return { circles: [] };
    return { circles: all('SELECT * FROM circles WHERE gender = ? ORDER BY created_at DESC', ctx.user.gender).map((c) => circleOut(ctx.user, c)) };
  });
  route('POST', '/api/circles', (ctx) => {
    if (!rules.GENDERS.includes(ctx.user.gender)) fail(403, 'Channels cannot create circles');
    if (isChild(ctx.user)) fail(403, 'Ask your parent to help you join a circle');
    const name = str(ctx.body.name, { min: 3, max: 50, name: 'Circle name' });
    const description = str(ctx.body.description || '', { max: 200, name: 'Description' });
    for (const t of [name, description]) if (screenText(t).action !== 'allow') fail(422, 'Please keep the circle name and description clean');
    const emoji = typeof ctx.body.emoji === 'string' && ctx.body.emoji.length <= 4 ? ctx.body.emoji : '🌙';
    const res = run('INSERT INTO circles (name, description, gender, emoji, created_by, created_at) VALUES (?,?,?,?,?,?)',
      name, description, ctx.user.gender, emoji, ctx.user.id, now());
    run('INSERT INTO circle_members (circle_id, user_id) VALUES (?,?)', Number(res.lastInsertRowid), ctx.user.id);
    return { circle: circleOut(ctx.user, get('SELECT * FROM circles WHERE id = ?', Number(res.lastInsertRowid))) };
  });
  route('GET', '/api/circles/:id', (ctx) => {
    assertNotTimeLocked(ctx.user);
    const c = get('SELECT * FROM circles WHERE id = ?', Number(ctx.params.id));
    if (!rules.canAccessCircle(ctx.user, c)) fail(404, 'Circle not found');
    const vis = rules.visibleAuthorSql(ctx.user, 'u');
    const rows = all(`${POST_SELECT} WHERE p.circle_id = ? AND (p.status = 'published' OR p.author_id = ?) AND ${vis}
        ORDER BY p.created_at DESC LIMIT 100`, c.id, ctx.user.id);
    return { circle: circleOut(ctx.user, c), posts: enrichPosts(ctx.user, rows) };
  });
  route('POST', '/api/circles/:id/join', (ctx) => {
    const c = get('SELECT * FROM circles WHERE id = ?', Number(ctx.params.id));
    if (!rules.canAccessCircle(ctx.user, c)) fail(404, 'Circle not found');
    const r = run('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?', c.id, ctx.user.id);
    if (!r.changes) run('INSERT INTO circle_members (circle_id, user_id) VALUES (?,?)', c.id, ctx.user.id);
    return { circle: circleOut(ctx.user, c) };
  });

  // --- deeds, streaks, tasbih (private)
  route('GET', '/api/deeds', (ctx) => deedSummary(ctx.user, checkDay(ctx.query.get('day'))));
  route('POST', '/api/deeds', (ctx) => {
    const day = checkDay(ctx.body.day);
    const key = ctx.body.key;
    if (key === 'tasbih') {
      const add = Math.max(1, Math.min(1000, Number(ctx.body.add) | 0));
      run('INSERT INTO deeds (user_id, day, key, value) VALUES (?,?,?,?) ON CONFLICT(user_id, day, key) DO UPDATE SET value = value + excluded.value',
        ctx.user.id, day, key, add);
    } else {
      if (!DEED_POINTS[key]) fail(400, 'Unknown deed');
      if (ctx.body.done) run('INSERT OR IGNORE INTO deeds (user_id, day, key, value) VALUES (?,?,?,1)', ctx.user.id, day, key);
      else run('DELETE FROM deeds WHERE user_id = ? AND day = ? AND key = ?', ctx.user.id, day, key);
    }
    return deedSummary(ctx.user, day);
  });

  // --- family (guardian controls)
  function childOf(guardian, id) {
    const child = userById(Number(id));
    if (!child || child.guardian_id !== guardian.id) fail(404, 'Child account not found');
    return child;
  }
  route('GET', '/api/family', (ctx) => {
    const kids = all('SELECT * FROM users WHERE guardian_id = ? ORDER BY created_at', ctx.user.id).map((c) => ({
      ...publicUser(c),
      dmsEnabled: !!c.dms_enabled,
      dailyLimitMin: c.daily_limit_min,
      secondsToday: secondsToday(c),
      age: ageOf(c),
      pending: all("SELECT * FROM posts WHERE author_id = ? AND status = 'guardian' ORDER BY created_at DESC", c.id)
        .map((p) => ({ id: p.id, body: p.body, category: p.category, image: p.image ? `/api/media/${p.image}` : null, createdAt: p.created_at })),
      following: all('SELECT u.* FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? LIMIT 50', c.id).map(publicUser),
    }));
    const guardian = ctx.user.guardian_id ? publicUser(userById(ctx.user.guardian_id)) : null;
    return { children: kids, guardian };
  });
  route('POST', '/api/family/children', (ctx) => {
    if (isChild(ctx.user) || ageOf(ctx.user) < 18 || !rules.GENDERS.includes(ctx.user.gender)) fail(403, 'Only adult members can add child accounts');
    const a = validateNewAccount(ctx.body);
    if (new Date().getUTCFullYear() - a.birthYear >= 18) fail(400, 'Child accounts are for under-18s');
    const limit = Math.max(0, Math.min(600, Number(ctx.body.dailyLimitMin ?? 60) | 0));
    const child = insertUser(a, { guardianId: ctx.user.id, dailyLimitMin: limit, dmsEnabled: !!ctx.body.dmsEnabled });
    return { child: publicUser(child) };
  });
  route('PATCH', '/api/family/children/:id', (ctx) => {
    const child = childOf(ctx.user, ctx.params.id);
    const limit = ctx.body.dailyLimitMin !== undefined ? Math.max(0, Math.min(600, Number(ctx.body.dailyLimitMin) | 0)) : child.daily_limit_min;
    const dms = ctx.body.dmsEnabled !== undefined ? (ctx.body.dmsEnabled ? 1 : 0) : child.dms_enabled;
    run('UPDATE users SET daily_limit_min = ?, dms_enabled = ? WHERE id = ?', limit, dms, child.id);
    return { ok: true };
  });
  route('POST', '/api/family/posts/:id/:action', (ctx) => {
    const post = get('SELECT * FROM posts WHERE id = ?', Number(ctx.params.id));
    if (!post || post.status !== 'guardian') fail(404, 'Post not found');
    const child = childOf(ctx.user, post.author_id);
    if (ctx.params.action === 'approve') {
      const needsMod = post.image && !child.trusted;
      run('UPDATE posts SET status = ?, review_reason = ? WHERE id = ?',
        needsMod ? 'pending' : 'published', needsMod ? 'Approved by parent; image awaiting moderator' : null, post.id);
    } else if (ctx.params.action === 'reject') {
      run("UPDATE posts SET status = 'hidden', review_reason = 'Not approved by parent' WHERE id = ?", post.id);
    } else fail(400, 'Unknown action');
    return { ok: true };
  });

  // --- moderation (same-gender moderators)
  function requireMod(user) { if (user.kind !== 'moderator') fail(403, 'Moderators only'); }
  route('GET', '/api/mod/queue', (ctx) => {
    requireMod(ctx.user);
    const pending = all(`${POST_SELECT} WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT 100`)
      .filter((r) => rules.canModerate(ctx.user, authorOf(r)))
      .map((r) => ({ id: r.id, body: r.body, category: r.category, image: r.image ? `/api/media/${r.image}` : null, reason: r.review_reason, createdAt: r.created_at, author: publicUser(authorOf(r)) }));
    const reports = all(`SELECT r.*, COALESCE(p.body, c.body) AS body, u.id AS uid, u.gender, u.kind, u.verified, u.username, u.display_name, u.avatar_hue, u.bio, u.guardian_id
        FROM reports r LEFT JOIN posts p ON p.id = r.post_id LEFT JOIN comments c ON c.id = r.comment_id
        JOIN users u ON u.id = COALESCE(p.author_id, c.author_id) WHERE r.status = 'open' ORDER BY r.created_at ASC LIMIT 100`)
      .filter((r) => rules.canModerate(ctx.user, { id: r.uid, gender: r.gender }))
      .map((r) => ({ id: r.id, postId: r.post_id, commentId: r.comment_id, reason: r.reason, body: r.body, author: publicUser({ ...r, id: r.uid }) }));
    return { pending, reports };
  });
  route('POST', '/api/mod/posts/:id', (ctx) => {
    requireMod(ctx.user);
    const row = get(`${POST_SELECT} WHERE p.id = ?`, Number(ctx.params.id));
    if (!row || !rules.canModerate(ctx.user, authorOf(row))) fail(404, 'Not found');
    if (ctx.body.action === 'approve') {
      run("UPDATE posts SET status = 'published', review_reason = NULL WHERE id = ?", row.id);
      run("UPDATE reports SET status = 'dismissed' WHERE post_id = ? AND status = 'open'", row.id);
      const approvedImages = get("SELECT COUNT(*) AS c FROM posts WHERE author_id = ? AND image IS NOT NULL AND status = 'published'", row.author_id).c;
      if (approvedImages >= 3) run('UPDATE users SET trusted = 1 WHERE id = ?', row.author_id);
      notify(row.author_id, ctx.user, 'approved', row.id, 'Your post was approved');
    } else if (ctx.body.action === 'hide') {
      run("UPDATE posts SET status = 'hidden', review_reason = 'Removed by a moderator' WHERE id = ?", row.id);
      run("UPDATE reports SET status = 'actioned' WHERE post_id = ? AND status = 'open'", row.id);
    } else fail(400, 'Unknown action');
    return { ok: true };
  });
  route('POST', '/api/mod/reports/:id', (ctx) => {
    requireMod(ctx.user);
    const r = get('SELECT * FROM reports WHERE id = ?', Number(ctx.params.id));
    if (!r) fail(404, 'Not found');
    const authorId = r.post_id ? get('SELECT author_id FROM posts WHERE id = ?', r.post_id)?.author_id : get('SELECT author_id FROM comments WHERE id = ?', r.comment_id)?.author_id;
    if (!authorId || !rules.canModerate(ctx.user, userById(authorId))) fail(404, 'Not found');
    if (ctx.body.action === 'remove') {
      if (r.post_id) run("UPDATE posts SET status = 'hidden', review_reason = 'Removed by a moderator' WHERE id = ?", r.post_id);
      if (r.comment_id) run("UPDATE comments SET status = 'hidden' WHERE id = ?", r.comment_id);
      run("UPDATE reports SET status = 'actioned' WHERE id = ?", r.id);
    } else if (ctx.body.action === 'dismiss') {
      run("UPDATE reports SET status = 'dismissed' WHERE id = ?", r.id);
      if (r.post_id) run("UPDATE posts SET status = 'published', review_reason = NULL WHERE id = ? AND review_reason = 'Reported by the community'", r.post_id);
    } else fail(400, 'Unknown action');
    return { ok: true };
  });

  // ---------- HTTP plumbing ----------
  const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'",
  };
  const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  function serveStatic(req, res, pathname) {
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.normalize(path.join(publicDir, rel));
    const target = file.startsWith(publicDir) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(publicDir, 'index.html');
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': STATIC_TYPES[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://local');
    const headers = [];
    const send = (status, obj) => {
      if (res.headersSent) return;
      res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(headers.length ? { 'Set-Cookie': headers } : {}) });
      res.end(JSON.stringify(obj));
    };
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
    try {
      const match = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
      if (!match) fail(404, 'Not found');
      // CSRF: state-changing requests must carry our custom header (cannot be sent cross-site without CORS)
      if (req.method !== 'GET' && req.headers['x-sakinah'] !== '1') fail(403, 'Missing request header');
      const params = {};
      const m = match.re.exec(url.pathname);
      match.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      let body = {};
      if (req.method !== 'GET') {
        const raw = await readBody(req);
        if (raw) { try { body = JSON.parse(raw); } catch { fail(400, 'Invalid JSON'); } }
        if (!body || typeof body !== 'object') body = {};
      }
      const token = parseCookies(req.headers.cookie).sk_session;
      let user = null;
      if (token) {
        const s = get('SELECT user_id FROM sessions WHERE token_hash = ?', sha256(token));
        if (s) user = userById(s.user_id);
      }
      if (match.auth && !user) fail(401, 'Please sign in');
      const ctx = {
        req, res, params, body, user, token, query: url.searchParams,
        ip: req.socket.remoteAddress,
        setCookie: (c) => headers.push(c),
        sendFile: (file, type, extra) => {
          if (!fs.existsSync(file)) fail(404, 'Not found');
          res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, ...extra });
          fs.createReadStream(file).pipe(res);
        },
      };
      const result = await match.handler(ctx);
      if (!res.headersSent) send(200, result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) send(e.status, { error: e.message, ...(e.extra || {}) });
      else { console.error(e); send(500, { error: 'Something went wrong' }); }
    }
  };
}

module.exports = { createApp, hashPassword, verifyPassword };
