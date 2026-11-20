'use strict';
/* Sakinah client — vanilla JS, no build step. All user text goes through textContent (never innerHTML). */

// ---------------------------------------------------------------- utilities
const $ = (sel, root = document) => root.querySelector(sel);

// Let append/prepend/replaceChildren accept nested arrays and skip null/false, so views can
// use `cond ? node : null` freely (native DOM would print "null" or stringify arrays).
for (const m of ['append', 'prepend', 'replaceChildren']) {
  const native = Element.prototype[m];
  Element.prototype[m] = function patched(...kids) {
    return native.apply(this, kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  };
}

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v; // only ever used with our own static icon SVG
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  circles: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M3.5 19c.6-3 2.9-5 5.5-5s4.9 2 5.5 5M14.5 14.6c2.6-.4 5 1.2 5.8 4.4"/>',
  deen: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="m17 3 .7 1.6 1.6.7-1.6.7L17 7.6l-.7-1.6-1.6-.7 1.6-.7z"/>',
  message: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.4 4.2-7 8-7s7 2.6 8 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  family: '<circle cx="8" cy="6.5" r="2.5"/><circle cx="16" cy="6.5" r="2.5"/><circle cx="12" cy="13" r="2"/><path d="M3.5 20c0-4 2-7 4.5-7M20.5 20c0-4-2-7-4.5-7M9 20c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  send: '<path d="M4 12 20 4l-5 16-3-7z"/><path d="m12 13 8-9"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  comment: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const icon = (name, cls = '') => h('span', { class: `ic ${cls}`, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`, style: { display: 'inline-grid' } });
const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16977a"/><stop offset="1" stop-color="#074236"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#lg)"/><path d="M24 7l4.2 10.1L38.4 21l-10.2 4.2L24 35.4l-4.2-10.2L9.6 21l10.2-3.9z" fill="none" stroke="#f1d58f" stroke-width="1.6"/><path d="M29.5 31.5a9 9 0 1 1-6.6-15.3 7 7 0 1 0 6.6 15.3z" fill="#fff"/></svg>';
const logo = () => h('div', { class: 'brand' }, h('span', { html: LOGO }), h('div', null, h('div', { class: 'brand-name' }, 'Sakinah'), h('div', { class: 'brand-sub' }, 'سَكِينَة')));

const REACTIONS = [
  { key: 'mashallah', em: '🌸', label: 'MashaAllah' },
  { key: 'jazakallah', em: '🤲', label: 'JazakAllah' },
  { key: 'subhanallah', em: '✨', label: 'SubhanAllah' },
  { key: 'ameen', em: '🤍', label: 'Ameen' },
];
const CATEGORIES = {
  general: '💬 General', reminder: '💡 Reminder', quran: "📖 Qur'an", hadith: '📜 Hadith', dua: '🤲 Dua request',
  question: '❓ Question', family: '🏡 Family', news: '📰 News',
};
const FEED_TABS = [
  ['foryou', 'For you'], ['following', 'Following'], ['knowledge', 'Knowledge'], ['duas', 'Duas'],
  ['questions', 'Questions'], ['news', 'News'], ['saved', 'Saved'],
];

function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const hr = Math.round(m / 60); if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24); if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(`sk_${k}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(`sk_${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};
const isArabic = (t) => /[؀-ۿ]/.test(t) && (t.match(/[؀-ۿ]/g) || []).length > t.length * 0.4;

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

// ---------------------------------------------------------------- API
class ApiError extends Error { constructor(status, data) { super(data.error || 'Error'); this.status = status; this.data = data; } }
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Sakinah': '1' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && state.me) { state.me = null; render(); }
  if (res.status === 423) showTimeUp();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// ---------------------------------------------------------------- state
const state = {
  me: null,
  unread: { notifications: 0, messages: 0 },
  loc: store.get('loc', null),
  prayerOpts: store.get('prayerOpts', { method: 'MWL', asr: 'shafi' }),
  sessionStart: Date.now(),
  scrolledPosts: 0,
};
const side = () => (state.me?.gender === 'female' ? 'sisters' : 'brothers');
const Side = () => (state.me?.gender === 'female' ? 'Sisters' : 'Brothers');
const location_ = () => state.loc || { lat: 21.4225, lng: 39.8262, label: 'Makkah (default)' };

// ---------------------------------------------------------------- avatar (geometric, never photos)
function avatar(user, size = '') {
  const hue = user?.avatarHue ?? 160;
  const initial = (user?.displayName || '?').trim().charAt(0).toUpperCase();
  const c1 = `hsl(${hue} 55% 38%)`;
  const c2 = `hsl(${(hue + 40) % 360} 60% 28%)`;
  const svg = `<svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice"><rect width="40" height="40" fill="${c2}"/><path d="M20 -2l6 14 14 6-14 6-6 14-6-14-14-6 14-6z" fill="${c1}"/><rect x="10" y="10" width="20" height="20" transform="rotate(45 20 20)" fill="none" stroke="rgba(255,255,255,.18)"/></svg>`;
  return h('div', { class: `avatar ${size}`, html: svg, 'aria-hidden': 'true' }, h('span', null, initial));
}
function nameLine(user) {
  return [
    h('span', { class: 'nm' }, user.displayName),
    user.verified ? h('span', { class: 'verified', title: 'Verified', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${ICONS.check}</svg>` }) : null,
    user.kind === 'scholar' ? h('span', { class: 'kind-tag' }, 'Scholar') : null,
    user.kind === 'news' ? h('span', { class: 'kind-tag news' }, 'News') : null,
    user.kind === 'moderator' ? h('span', { class: 'kind-tag news' }, 'Mod') : null,
  ];
}

// ---------------------------------------------------------------- modal
function modal(title, body, { onClose } = {}) {
  const close = () => { back.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, title, h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('x'))),
      h('div', { class: 'modal-body' }, body)));
  document.addEventListener('keydown', esc);
  document.body.append(back);
  return close;
}

// ---------------------------------------------------------------- posts
function postCard(post, { onChange, detail = false } = {}) {
  const el = h('article', { class: 'card post' });
  const draw = () => {
    el.replaceChildren();
    const open = () => { if (!detail) location.hash = `#/post/${post.id}`; };
    let menuEl = null;
    const toggleMenu = (e) => {
      e.stopPropagation();
      if (menuEl) { menuEl.remove(); menuEl = null; return; }
      menuEl = h('div', { class: 'menu' },
        post.isMine
          ? h('button', { class: 'btn-danger', onclick: async () => {
            if (!confirm('Delete this post?')) return;
            await api('DELETE', `/api/posts/${post.id}`);
            el.remove(); toast('Post deleted');
            if (detail) history.back();
          } }, 'Delete post')
          : h('button', { onclick: () => reportDialog({ postId: post.id }) }, '⚑ Report'),
        h('button', { onclick: () => { navigator.clipboard?.writeText(`${location.origin}/#/post/${post.id}`); toast('Link copied'); } }, 'Copy link'));
      wrap.append(menuEl);
      setTimeout(() => document.addEventListener('click', () => { menuEl?.remove(); menuEl = null; }, { once: true }));
    };
    const wrap = h('div', { style: { position: 'relative' } }, h('button', { class: 'icon-btn', 'aria-label': 'More', onclick: toggleMenu }, icon('more')));

    el.append(
      h('div', { class: 'post-head' },
        h('a', { href: `#/u/${post.author.username}` }, avatar(post.author)),
        h('div', { class: 'grow' },
          h('a', { href: `#/u/${post.author.username}`, class: 'post-name' }, nameLine(post.author)),
          h('div', { class: 'post-meta' }, `@${post.author.username}`, '·', h('a', { href: `#/post/${post.id}` }, timeAgo(post.createdAt)),
            post.category !== 'general' ? h('span', { class: 'cat' }, CATEGORIES[post.category]) : null)),
        wrap),
      h('div', { class: 'post-body', dir: isArabic(post.body) ? 'rtl' : 'auto', onclick: open, style: { cursor: detail ? 'auto' : 'pointer' } }, post.body),
      post.image ? h('div', { class: 'post-img', onclick: open }, h('img', { src: post.image, alt: 'Post image', loading: 'lazy' })) : null,
      post.status !== 'published' ? h('div', { class: 'status-banner' }, '⏳ Only you can see this — ', post.reviewReason || 'awaiting review') : null,
      post.status === 'published' ? h('div', { class: 'post-actions' },
        REACTIONS.map((r) => {
          const on = post.myReactions.includes(r.key);
          const count = post.reactions[r.key];
          return h('button', {
            class: `react ${on ? 'on' : ''}`, title: r.label, 'aria-pressed': String(on),
            onclick: async (e) => {
              const btn = e.currentTarget;
              btn.classList.add('pop');
              if (!on && navigator.vibrate) navigator.vibrate(8);
              try { post = (await api('POST', `/api/posts/${post.id}/react`, { type: r.key })).post; draw(); onChange && onChange(post); } catch (err) { toast(err.message); }
            },
          }, h('span', { class: 'em' }, r.em), h('span', { class: 'react-label' }, r.label), count ? h('span', null, count) : null);
        }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'react', onclick: open, 'aria-label': 'Comments' }, icon('comment'), post.commentCount ? h('span', null, post.commentCount) : null),
        h('button', {
          class: `react ${post.bookmarked ? 'on' : ''}`, 'aria-label': 'Save',
          onclick: async () => { const r = await api('POST', `/api/posts/${post.id}/bookmark`); post.bookmarked = r.bookmarked; draw(); toast(r.bookmarked ? 'Saved' : 'Removed from saved'); },
        }, icon('bookmark'))) : null,
    );
  };
  draw();
  return el;
}

function reportDialog(target) {
  const reasons = ['Haram or immodest content', 'Image of the opposite gender', 'Backbiting or slander', 'False or misleading information', 'Harassment or bullying', 'Spam', 'Other'];
  let close;
  const body = h('div', { class: 'stack' },
    h('p', { class: 'muted', style: { margin: 0 } }, 'Reports are reviewed by a moderator from the same side of the community.'),
    reasons.map((r) => h('button', { class: 'btn btn-block', style: { justifyContent: 'flex-start' }, onclick: async () => {
      try { const res = await api('POST', '/api/report', { ...target, reason: r }); toast(res.message); close(); } catch (e) { toast(e.message); }
    } }, r)));
  close = modal('Report', body);
}

function composer({ circleId = null, onPosted } = {}) {
  let image = null;
  let category = state.me.kind === 'news' ? 'news' : 'general';
  const err = h('div', { class: 'error hidden' });
  const text = h('textarea', { class: 'input', maxlength: 2000, rows: 5, placeholder: state.me.kind === 'news' ? 'Share verified news…' : 'Share something beneficial… a reminder, a question, a dua request',
    oninput: () => { count.textContent = `${text.value.length}/2000`; } });
  const count = h('span', { class: 'hint' }, '0/2000');
  const preview = h('div');
  const pledge = h('input', { type: 'checkbox', id: 'imgpledge' });
  const pledgeBox = h('div', { class: 'pledge hidden' },
    h('b', null, 'Image guidelines'),
    h('ul', null,
      h('li', null, 'No pictures of the opposite gender — ever'),
      h('li', null, 'No immodest, violent or haram imagery'),
      h('li', null, 'No pictures of other people without their permission'),
      h('li', null, 'Children: no faces of other children')),
    h('label', { class: 'row' }, pledge, 'I confirm this image follows the guidelines'));
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'hidden', onchange: async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      image = await shrinkImage(f);
      preview.replaceChildren(h('div', { class: 'post-img', style: { position: 'relative' } },
        h('img', { src: image, alt: 'Preview' }),
        h('button', { class: 'icon-btn', style: { position: 'absolute', top: '6px', right: '6px', background: 'var(--surface)' }, 'aria-label': 'Remove image', onclick: () => { image = null; preview.replaceChildren(); pledgeBox.classList.add('hidden'); file.value = ''; } }, icon('x'))));
      pledgeBox.classList.remove('hidden');
    } catch { toast('Could not read that image'); }
  } });
  const cats = state.me.kind === 'news' ? [] : ['general', 'reminder', 'quran', 'hadith', 'dua', 'question', 'family'];
  const chipRow = h('div', { class: 'chips' }, cats.map((c) => h('button', { class: `chip ${c === category ? 'active' : ''}`, onclick: (e) => {
    category = c; chipRow.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); e.currentTarget.classList.add('active');
  } }, CATEGORIES[c])));
  const submit = h('button', { class: 'btn btn-primary', onclick: async () => {
    err.classList.add('hidden');
    submit.disabled = true;
    try {
      const { post } = await api('POST', '/api/posts', { body: text.value, category, circleId, image, imagePledge: pledge.checked });
      close();
      if (post.status === 'guardian') toast('Sent to your parent for approval 👍');
      else if (post.status === 'pending') toast('Posted — waiting for a quick moderator check');
      else toast('Posted. May Allah reward you 🌙');
      onPosted && onPosted(post);
    } catch (e) {
      err.textContent = e.message; err.classList.remove('hidden');
    } finally { submit.disabled = false; }
  } }, 'Post');
  const body = h('div', { class: 'stack' },
    h('div', { class: 'row' }, avatar(state.me, 'sm'), h('div', { class: 'small muted' }, circleId ? 'Posting to this circle' : `Visible to ${side()} only`, state.me.isChild ? ' · your parent will approve it first' : '')),
    text,
    cats.length ? chipRow : null,
    preview, pledgeBox, err,
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-ghost', onclick: () => file.click() }, icon('image'), 'Photo'), file,
      h('span', { class: 'grow' }), count, submit),
    h('p', { class: 'hint', style: { margin: 0 } }, '“Whoever believes in Allah and the Last Day, let him speak good or remain silent.” — Bukhari & Muslim'));
  const close = modal(circleId ? 'Post to circle' : 'Create post', body);
  setTimeout(() => text.focus(), 50);
}

async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); // re-encoding also strips EXIF/location
  return c.toDataURL('image/jpeg', 0.85);
}

// ---------------------------------------------------------------- views
function dailyCard(daily) {
  return h('section', { class: 'card pad daily' },
    h('div', { class: 'row' }, h('div', { class: 'label grow' }, 'Ayah of the day'), h('div', { class: 'small', style: { opacity: 0.8 } }, Prayer.hijri(new Date()))),
    h('div', { class: 'ar' }, daily.ayah.ar),
    h('div', { class: 'en' }, daily.ayah.en),
    h('div', { class: 'ref' }, daily.ayah.ref));
}

async function viewHome(root, tab = 'foryou') {
  let page = 0;
  let loading = false;
  let done = false;
  const list = h('div', { class: 'feed' });
  const sentinel = h('div', { style: { height: '1px' } });
  const top = h('div', { class: 'stack' });
  const chips = h('div', { class: 'chips', role: 'tablist' }, FEED_TABS.map(([k, label]) => h('a', { class: `chip ${k === tab ? 'active' : ''}`, href: `#/home/${k}`, role: 'tab' }, label)));
  root.append(
    top,
    h('div', { class: 'card composer-prompt', onclick: () => composer({ onPosted: () => route() }) },
      avatar(state.me), h('div', { class: 'fake' }, state.me.kind === 'news' ? 'Share verified news…' : `What's beneficial today, ${state.me.displayName.split(' ')[0]}?`)),
    chips, list, sentinel);
  if (tab === 'foryou') api('GET', `/api/daily?day=${localDay()}`).then((d) => top.prepend(dailyCard(d))).catch(() => {});

  const load = async () => {
    if (loading || done) return;
    loading = true;
    if (!page) list.append(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
    try {
      const { posts, hasMore } = await api('GET', `/api/feed?tab=${tab}&page=${page}`);
      list.querySelectorAll('.skeleton').forEach((s) => s.remove());
      if (!page && !posts.length) {
        list.append(h('div', { class: 'card empty' }, h('div', { class: 'big' }, tab === 'saved' ? '🔖' : '🌱'),
          h('p', null, tab === 'following' ? 'Follow brothers and sisters, scholars and news channels to fill this feed.' : tab === 'saved' ? 'Posts you save will appear here.' : 'Nothing here yet.')));
      }
      for (const p of posts) {
        list.append(postCard(p));
        state.scrolledPosts += 1;
        if (state.scrolledPosts % 25 === 0) list.append(pauseCard());
      }
      page += 1;
      if (!hasMore) {
        done = true;
        if (posts.length || page > 1) list.append(caughtUpCard());
      }
    } catch (e) {
      list.querySelectorAll('.skeleton').forEach((s) => s.remove());
      if (e.status !== 423) list.append(h('div', { class: 'error' }, e.message));
      done = true;
    } finally { loading = false; }
  };
  const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(); }, { rootMargin: '600px' });
  io.observe(sentinel);
  cleanup.push(() => io.disconnect());
  await load();
}

function caughtUpCard() {
  return h('div', { class: 'card end-card' },
    h('div', { class: 'big' }, '🌙'),
    h('h3', { style: { margin: '6px 0' } }, "You're all caught up"),
    h('p', { class: 'muted' }, "That's everything for now. Why not spend the next minute in dhikr?"),
    h('a', { class: 'btn btn-primary', href: '#/deen' }, 'Open tasbih'));
}
function pauseCard() {
  const mins = Math.round((Date.now() - state.sessionStart) / 60000);
  return h('div', { class: 'card pad pause-card row' },
    h('div', { style: { fontSize: '30px' } }, '⏸️'),
    h('div', { class: 'grow' }, h('b', null, `You've been here ${mins} min.`), h('div', { class: 'small muted' }, 'A good moment for SubhanAllah ×33, or a page of Qur’an.')),
    h('a', { class: 'btn btn-sm', href: '#/deen' }, 'Take a break'));
}

async function viewPost(root, id) {
  const { post, comments } = await api('GET', `/api/posts/${id}`);
  const list = h('div', { class: 'card pad' });
  const drawComments = (cs) => {
    list.replaceChildren(
      h('div', { class: 'section-title' }, `Comments from ${side()}`),
      cs.length ? cs.map((c) => h('div', { class: 'comment' },
        h('a', { href: `#/u/${c.author.username}` }, avatar(c.author, 'sm')),
        h('div', { class: 'bubble' },
          h('div', { class: 'who' }, nameLine(c.author), h('span', { class: 'muted small' }, timeAgo(c.createdAt))),
          h('div', { class: 'txt', dir: 'auto' }, c.body),
          c.isMine ? h('button', { class: 'btn btn-ghost btn-sm btn-danger', onclick: async () => { await api('DELETE', `/api/comments/${c.id}`); route(); } }, 'Delete')
            : h('button', { class: 'btn btn-ghost btn-sm muted', onclick: () => reportDialog({ commentId: c.id }) }, 'Report')))) : h('p', { class: 'muted' }, 'No comments yet. Be the first to say something good.'));
  };
  drawComments(comments);
  const input = h('textarea', { class: 'input', rows: 2, maxlength: 600, placeholder: 'Write a kind, beneficial comment…' });
  const form = h('div', { class: 'card pad stack' },
    input,
    h('div', { class: 'row' }, h('span', { class: 'hint grow' }, `🔒 Only ${side()} can see ${side()}' comments.`),
      h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
        try { const r = await api('POST', `/api/posts/${post.id}/comments`, { body: input.value }); input.value = ''; drawComments(r.comments); } catch (e) { toast(e.message); }
      } }, 'Comment')));
  root.append(backBar('Post'), h('div', { class: 'stack' }, postCard(post, { detail: true }), post.status === 'published' ? form : null, list));
}

function backBar(title) {
  return h('div', { class: 'row', style: { margin: '0 0 12px' } },
    h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => (history.length > 1 ? history.back() : (location.hash = '#/home')) }, icon('back')),
    h('h1', { class: 'page-title', style: { margin: 0 } }, title));
}

async function viewProfile(root, username) {
  const data = await api('GET', `/api/users/${encodeURIComponent(username)}`);
  const u = data.user;
  const isMe = u.id === state.me.id;
  let following = data.isFollowing;
  const followBtn = h('button', { class: `btn ${following ? '' : 'btn-primary'}`, onclick: async () => {
    const r = await api('POST', `/api/users/${u.username}/follow`);
    following = r.following;
    followBtn.className = `btn ${following ? '' : 'btn-primary'}`;
    followBtn.textContent = following ? 'Following' : 'Follow';
  } }, following ? 'Following' : 'Follow');
  root.append(
    h('div', { class: 'card', style: { overflow: 'hidden' } },
      h('div', { class: 'profile-cover' }),
      h('div', { class: 'profile-body' },
        h('div', { class: 'row', style: { alignItems: 'flex-end' } }, avatar(u, 'lg'), h('span', { class: 'grow' }),
          isMe ? h('a', { class: 'btn', href: '#/settings' }, 'Edit profile') : [
            data.canMessage ? h('a', { class: 'btn', href: `#/messages/${u.username}` }, icon('message'), 'Message') : null,
            followBtn]),
        h('div', { class: 'profile-name' }, nameLine(u)),
        h('div', { class: 'muted' }, `@${u.username}`, u.isChild ? ' · Young member 🌱' : ''),
        u.bio ? h('p', { style: { margin: '10px 0 0' } }, u.bio) : null,
        h('div', { class: 'stats' }, h('span', null, h('b', null, data.stats.posts), ' posts'), h('span', null, h('b', null, data.stats.followers), ' followers'), h('span', null, h('b', null, data.stats.following), ' following')),
        u.isChannel && !isMe ? h('div', { class: 'notice', style: { marginTop: '12px' } }, '🔒', h('span', null, `Verified ${u.kind === 'news' ? 'news channel' : 'scholar'}. Comments and reactions you leave here are only seen by ${side()}.`)) : null)),
    h('div', { class: 'feed', style: { marginTop: '14px' } },
      data.posts.length ? data.posts.map((p) => postCard(p)) : h('div', { class: 'card empty' }, h('div', { class: 'big' }, '📝'), h('p', null, 'No posts yet.'))));
}

async function viewMessages(root) {
  const { conversations } = await api('GET', '/api/conversations');
  root.append(h('h1', { class: 'page-title' }, 'Messages'),
    h('div', { class: 'notice', style: { marginBottom: '14px' } }, '🔒', h('span', null, `Messages on Sakinah are only ever between ${side()}. Nobody from the other side can find you, follow you or message you.`)),
    h('div', { class: 'card', style: { overflow: 'hidden' } },
      conversations.length ? conversations.map((c) => h('a', { class: 'conv', href: `#/messages/${c.user.username}` },
        avatar(c.user),
        h('div', { class: 'grow' },
          h('div', { class: 'row' }, h('b', { class: 'grow post-name' }, nameLine(c.user)), h('span', { class: 'small muted' }, timeAgo(c.last.createdAt))),
          h('div', { class: 'row' }, h('div', { class: 'small muted grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.last.fromMe ? 'You: ' : '', c.last.body),
            c.unread ? h('span', { class: 'badge' }, c.unread) : null))))
        : h('div', { class: 'empty' }, h('div', { class: 'big' }, '💬'), h('p', null, 'No conversations yet. Visit a profile to send salam.'))));
}

async function viewChat(root, username) {
  const log = h('div', { class: 'chat-log' });
  const input = h('input', { class: 'input', maxlength: 1000, placeholder: 'Message…', autocomplete: 'off' });
  const formEl = h('form', { class: 'chat-form', onsubmit: async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    try { await api('POST', `/api/messages/${username}`, { body: input.value }); input.value = ''; await refresh(); } catch (er) { toast(er.message); }
  } }, input, h('button', { class: 'btn btn-primary', 'aria-label': 'Send' }, icon('send')));
  const head = h('div', { class: 'chat-head' });
  root.append(h('div', { class: 'card chat' }, head, log, formEl));
  let lastCount = -1;
  const refresh = async () => {
    const data = await api('GET', `/api/messages/${encodeURIComponent(username)}`);
    head.replaceChildren(
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => (location.hash = '#/messages') }, icon('back')),
      h('a', { href: `#/u/${data.user.username}`, class: 'row grow' }, avatar(data.user, 'sm'), h('b', { class: 'post-name' }, nameLine(data.user))));
    if (data.messages.length !== lastCount) {
      lastCount = data.messages.length;
      log.replaceChildren(
        data.messages.length ? null : h('div', { class: 'empty' }, h('div', { class: 'big' }, '👋'), h('p', null, 'Start with salam: Assalamu alaykum!')),
        data.messages.map((m) => h('div', { class: `msg ${m.fromMe ? 'me' : ''}`, dir: 'auto' }, m.body, h('time', null, timeAgo(m.createdAt)))));
      log.scrollTop = log.scrollHeight;
    }
    if (!data.canSend) { formEl.replaceChildren(h('div', { class: 'notice grow' }, '🔒', h('span', null, data.blockedReason))); }
    refreshBadges();
  };
  await refresh();
  const t = setInterval(() => refresh().catch(() => {}), 5000);
  cleanup.push(() => clearInterval(t));
  input.focus();
}

async function viewCircles(root) {
  const { circles } = await api('GET', '/api/circles');
  const create = () => {
    const name = h('input', { class: 'input', maxlength: 50, placeholder: 'e.g. Fajr Risers' });
    const desc = h('textarea', { class: 'input', maxlength: 200, rows: 3, placeholder: 'What is this circle about?' });
    const emojis = ['🌙', '📖', '☀️', '🕌', '🤲', '🏡', '🌿', '💪', '🍲', '📚'];
    let emoji = emojis[0];
    const er = h('div', { class: 'error hidden' });
    const emojiRow = h('div', { class: 'chips' }, emojis.map((e) => h('button', { class: `chip ${e === emoji ? 'active' : ''}`, onclick: (ev) => { emoji = e; emojiRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('active')); ev.currentTarget.classList.add('active'); } }, e)));
    const close = modal('New circle', h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', null, 'Name'), name),
      h('div', { class: 'field' }, h('label', null, 'Description'), desc),
      h('div', { class: 'field' }, h('label', null, 'Icon'), emojiRow), er,
      h('p', { class: 'hint', style: { margin: 0 } }, `Circles are for ${side()} only.`),
      h('button', { class: 'btn btn-primary btn-block', onclick: async () => {
        try { const r = await api('POST', '/api/circles', { name: name.value, description: desc.value, emoji }); close(); location.hash = `#/circle/${r.circle.id}`; } catch (e) { er.textContent = e.message; er.classList.remove('hidden'); }
      } }, 'Create circle')));
  };
  root.append(
    h('div', { class: 'row' }, h('h1', { class: 'page-title grow' }, 'Circles'), state.me.isChild ? null : h('button', { class: 'btn btn-primary btn-sm', onclick: create }, icon('plus'), 'New')),
    h('p', { class: 'muted', style: { marginTop: '-8px' } }, `Halaqahs and small groups for ${side()}: study together, keep each other on track.`),
    h('div', { class: 'circle-grid' }, circles.map((c) => h('a', { class: 'card circle-card', href: `#/circle/${c.id}` },
      h('div', { class: 'circle-emoji' }, c.emoji), h('h3', null, c.name), h('div', { class: 'small muted' }, c.description),
      h('div', { class: 'row small' }, h('span', { class: 'muted grow' }, `${c.members} members`), c.joined ? h('span', { class: 'kind-tag news' }, 'Joined') : null)))));
}

async function viewCircle(root, id) {
  const data = await api('GET', `/api/circles/${id}`);
  const c = data.circle;
  const joinBtn = h('button', { class: `btn ${c.joined ? '' : 'btn-primary'}`, onclick: async () => { await api('POST', `/api/circles/${c.id}/join`); route(); } }, c.joined ? 'Leave' : 'Join circle');
  root.append(
    backBar('Circle'),
    h('div', { class: 'card pad stack' },
      h('div', { class: 'row' }, h('div', { class: 'circle-emoji' }, c.emoji), h('div', { class: 'grow' }, h('h2', { style: { margin: 0 } }, c.name), h('div', { class: 'small muted' }, `${c.members} ${side()}`)), joinBtn),
      c.description ? h('p', { style: { margin: 0 } }, c.description) : null,
      c.joined ? h('button', { class: 'btn btn-primary', onclick: () => composer({ circleId: c.id, onPosted: () => route() }) }, icon('plus'), 'Post to circle') : null),
    h('div', { class: 'feed', style: { marginTop: '14px' } }, data.posts.length ? data.posts.map((p) => postCard(p)) : h('div', { class: 'card empty' }, h('p', null, 'No posts yet.'))));
}

async function viewNotifications(root) {
  const { notifications } = await api('GET', '/api/notifications');
  api('POST', '/api/notifications/read').then(refreshBadges).catch(() => {});
  const text = (n) => ({
    reaction: `reacted ${REACTIONS.find((r) => r.key === n.text)?.em || ''} to your post`,
    comment: `commented: “${n.text}”`,
    follow: 'started following you',
    approved: 'approved your post',
  }[n.type] || n.text);
  root.append(h('h1', { class: 'page-title' }, 'Notifications'),
    h('div', { class: 'card', style: { overflow: 'hidden' } },
      notifications.length ? notifications.map((n) => h('a', { class: 'conv', href: n.postId ? `#/post/${n.postId}` : n.actor ? `#/u/${n.actor.username}` : '#/home', style: { background: n.read ? '' : 'var(--brand-soft)' } },
        n.actor ? avatar(n.actor, 'sm') : null,
        h('div', { class: 'grow' }, h('b', null, n.actor ? n.actor.displayName : 'Sakinah'), ' ', text(n), h('div', { class: 'small muted' }, timeAgo(n.createdAt)))))
        : h('div', { class: 'empty' }, h('div', { class: 'big' }, '🔔'), h('p', null, 'No notifications yet.'))));
}

async function viewSearch(root, q = '') {
  const input = h('input', { class: 'input', placeholder: `Search ${side()}, scholars, news and posts…`, value: q, type: 'search' });
  const results = h('div', { class: 'stack' });
  let t;
  const run = async () => {
    const term = input.value.trim();
    if (term.length < 2) {
      const { users } = await api('GET', '/api/suggestions');
      results.replaceChildren(h('div', { class: 'card pad' }, h('div', { class: 'section-title' }, 'Suggested for you'), users.map(userRow)));
      return;
    }
    const r = await api('GET', `/api/search?q=${encodeURIComponent(term)}`);
    results.replaceChildren(
      r.users.length ? h('div', { class: 'card pad' }, h('div', { class: 'section-title' }, 'People & channels'), r.users.map(userRow)) : null,
      r.posts.length ? h('div', { class: 'feed' }, r.posts.map((p) => postCard(p))) : null,
      !r.users.length && !r.posts.length ? h('div', { class: 'card empty' }, h('p', null, 'No results.')) : null);
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  root.append(h('h1', { class: 'page-title' }, 'Discover'), input, h('div', { style: { height: '14px' } }), results);
  run();
  input.focus();
}
function userRow(u) {
  return h('a', { class: 'list-user', href: `#/u/${u.username}` }, avatar(u, 'sm'), h('div', { class: 'grow' }, h('div', { class: 'nm' }, nameLine(u)), h('div', { class: 'un' }, `@${u.username}`)));
}

// ---------------------------------------------------------------- deen
const TASBIH = [
  { ar: 'سُبْحَانَ ٱللَّٰهِ', en: 'SubhanAllah' },
  { ar: 'ٱلْحَمْدُ لِلَّٰهِ', en: 'Alhamdulillah' },
  { ar: 'ٱللَّٰهُ أَكْبَرُ', en: 'Allahu Akbar' },
];

function prayerCard({ compact = false } = {}) {
  const el = h('section', { class: 'card pad prayer-hero' });
  const draw = () => {
    const { lat, lng, label } = location_();
    const st = Prayer.status(new Date(), lat, lng, state.prayerOpts);
    const diff = Math.max(0, st.nextAt - Date.now());
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    el.replaceChildren(
      h('div', { class: 'row' }, h('div', { class: 'small grow', style: { opacity: 0.8 } }, `📍 ${label}`), h('div', { class: 'small', style: { opacity: 0.8 } }, Prayer.hijri(new Date()))),
      h('div', { style: { marginTop: '8px', fontSize: '13px', opacity: 0.85 } }, 'Next prayer'),
      h('div', { class: 'next-name' }, Prayer.NAMES[st.next], ' · ', Prayer.fmt(st.nextAt)),
      h('div', { class: 'countdown' }, `in ${hh ? `${hh}h ` : ''}${mm}m ${compact ? '' : `${ss}s`}`),
      h('div', { class: 'prayer-list' }, Prayer.ORDER.map((k) => h('div', { class: k === st.current ? 'now' : '' }, Prayer.NAMES[k], h('b', null, Prayer.fmt(st.today[k]))))));
  };
  draw();
  const t = setInterval(() => { if (!el.isConnected) clearInterval(t); else draw(); }, compact ? 30000 : 1000);
  return el;
}

function askLocation() {
  if (!navigator.geolocation) return toast('Location is not available on this device');
  navigator.geolocation.getCurrentPosition((pos) => {
    state.loc = { lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), label: 'My location' };
    store.set('loc', state.loc);
    toast('Prayer times updated for your location');
    route();
  }, () => toast('Could not get your location'), { timeout: 10000 });
}

async function viewDeen(root) {
  const day = localDay();
  const [daily, deeds] = await Promise.all([api('GET', `/api/daily?day=${day}`), api('GET', `/api/deeds?day=${day}`)]);
  let summary = deeds;
  const deedsBox = h('div');
  const statsBox = h('div');
  const drawDeeds = () => {
    const doneCount = summary.deeds.filter((d) => summary.done[d.key]).length;
    statsBox.replaceChildren(
      h('div', { class: 'streak' },
        h('div', null, h('b', null, `🔥 ${summary.streak}`), h('span', null, 'day streak')),
        h('div', null, h('b', null, summary.hasanatToday), h('span', null, 'points today')),
        h('div', null, h('b', null, summary.hasanatTotal), h('span', null, 'all time'))),
      h('div', { class: 'progress', style: { marginTop: '12px' } }, h('i', { style: { width: `${(doneCount / summary.deeds.length) * 100}%` } })),
      h('div', { class: 'hint', style: { marginTop: '6px' } }, `${doneCount} of ${summary.deeds.length} done today · private to you — no leaderboards, no showing off`));
    const groups = [...new Set(summary.deeds.map((d) => d.group))];
    deedsBox.replaceChildren(...groups.map((g) => h('div', { style: { marginTop: '14px' } },
      h('div', { class: 'section-title' }, g),
      h('div', { class: 'deeds' }, summary.deeds.filter((d) => d.group === g).map((d) => {
        const done = !!summary.done[d.key];
        return h('button', { class: `deed ${done ? 'done' : ''}`, 'aria-pressed': String(done), onclick: async () => {
          if (!done && navigator.vibrate) navigator.vibrate(12);
          summary = await api('POST', '/api/deeds', { day, key: d.key, done: !done });
          drawDeeds();
          if (!done && summary.streak > deeds.streak && summary.streak > 1) toast(`🔥 ${summary.streak} day streak — MashaAllah!`);
        } }, h('span', { class: 'tick' }, icon('check')), d.label, h('span', { class: 'pts' }, `+${d.points}`));
      })))));
  };
  drawDeeds();

  // tasbih
  let count = summary.tasbih % 99;
  let pending = 0;
  let flushT;
  const countEl = h('div', { class: 'count' });
  const phraseEl = h('div', { class: 'phrase' });
  const enEl = h('div', { class: 'small muted' });
  const ring = h('div', { class: 'tasbih-ring' });
  const totalEl = h('div', { class: 'hint' });
  const drawTasbih = () => {
    const idx = Math.floor(count / 33) % 3;
    countEl.textContent = String(count % 33);
    phraseEl.textContent = TASBIH[idx].ar;
    enEl.textContent = `${TASBIH[idx].en} · ${count % 33}/33`;
    ring.replaceChildren(...[0, 1, 2].map((i) => h('i', { class: i < idx ? 'on' : '' })));
    totalEl.textContent = `${summary.tasbih + pending} today`;
  };
  const flush = async () => {
    if (!pending) return;
    const add = pending; pending = 0;
    try { summary = await api('POST', '/api/deeds', { day, key: 'tasbih', add }); drawDeeds(); drawTasbih(); } catch { pending += add; }
  };
  const tap = () => {
    count = (count + 1) % 99;
    pending += 1;
    if (navigator.vibrate) navigator.vibrate(count % 33 === 0 ? [30, 40, 30] : 6);
    if (count % 33 === 0) toast(count === 0 ? 'Completed 99 — MashaAllah! 🌟' : `${TASBIH[(count / 33) - 1].en} ×33 ✓`);
    drawTasbih();
    clearTimeout(flushT); flushT = setTimeout(flush, 1200);
  };
  cleanup.push(flush);
  drawTasbih();

  const { lat, lng, label } = location_();
  const bearing = Prayer.qibla(lat, lng);

  root.append(
    h('h1', { class: 'page-title' }, 'Deen'),
    h('div', { class: 'stack' },
      prayerCard(),
      !state.loc ? h('div', { class: 'notice gold' }, '📍', h('span', { class: 'grow' }, 'Prayer times are showing for Makkah.'), h('button', { class: 'btn btn-sm', onclick: askLocation }, 'Use my location')) : null,
      h('section', { class: 'card pad' }, h('div', { class: 'section-title' }, "Today's deeds"), statsBox, deedsBox),
      h('section', { class: 'card tasbih' },
        h('div', { class: 'section-title', style: { margin: 0 } }, 'Tasbih'),
        h('button', { class: 'tasbih-btn', onclick: tap, 'aria-label': 'Count' }, countEl, phraseEl),
        enEl, ring, totalEl,
        h('div', { class: 'hint' }, 'After every salah: 33 SubhanAllah, 33 Alhamdulillah, 33 Allahu Akbar.')),
      h('section', { class: 'card pad stack' },
        h('div', { class: 'section-title', style: { margin: 0 } }, 'Hadith of the day'),
        h('p', { style: { margin: 0, fontSize: '16px' } }, `“${daily.hadith.en}”`),
        h('div', { class: 'small muted' }, daily.hadith.ref)),
      h('section', { class: 'card pad' },
        h('div', { class: 'section-title' }, 'Qibla'),
        h('div', { class: 'qibla' },
          h('div', { class: 'compass' }, h('span', { class: 'n' }, 'N'), h('div', { class: 'needle', style: { transform: `rotate(${bearing}deg)` } }), h('div', { class: 'kaaba' })),
          h('div', null, h('b', { style: { fontSize: '22px' } }, `${bearing.toFixed(1)}°`), h('div', { class: 'small muted' }, `from true north · ${label}`)))),
      dailyCard(daily)));
}

// ---------------------------------------------------------------- family
async function viewFamily(root) {
  const data = await api('GET', '/api/family');
  root.append(h('h1', { class: 'page-title' }, 'Family'));
  if (data.guardian) {
    root.append(h('div', { class: 'card pad stack' },
      h('div', { class: 'row' }, avatar(data.guardian), h('div', null, h('b', null, data.guardian.displayName), h('div', { class: 'small muted' }, 'looks after your account'))),
      h('p', { style: { margin: 0 } }, 'Your posts are checked by your parent before others see them, and they set your daily time. Have fun and keep it beneficial! 🌱')));
    return;
  }
  const kids = h('div', { class: 'stack' });
  for (const c of data.children) {
    const used = Math.round(c.secondsToday / 60);
    const limitLabel = h('b');
    const slider = h('input', { type: 'range', min: 0, max: 180, step: 15, value: c.dailyLimitMin });
    const setLabel = () => { limitLabel.textContent = +slider.value ? `${slider.value} min/day` : 'No limit'; };
    setLabel();
    slider.addEventListener('input', setLabel);
    slider.addEventListener('change', async () => { await api('PATCH', `/api/family/children/${c.id}`, { dailyLimitMin: +slider.value }); toast('Time limit saved'); });
    const dms = h('input', { type: 'checkbox', checked: c.dmsEnabled, onchange: async () => { await api('PATCH', `/api/family/children/${c.id}`, { dmsEnabled: dms.checked }); toast(dms.checked ? 'Messages on (mutual follows only)' : 'Messages off'); } });
    kids.append(h('section', { class: 'card pad stack' },
      h('div', { class: 'row' }, avatar(c), h('div', { class: 'grow' }, h('b', null, c.displayName), h('div', { class: 'small muted' }, `@${c.username} · age ${c.age}`)), h('a', { class: 'btn btn-sm', href: `#/u/${c.username}` }, 'Profile')),
      h('div', null, h('div', { class: 'row small' }, h('span', { class: 'grow' }, `Today: ${used} min`), limitLabel),
        h('div', { class: 'progress', style: { margin: '6px 0 10px' } }, h('i', { style: { width: `${c.dailyLimitMin ? Math.min(100, (used / c.dailyLimitMin) * 100) : 0}%` } })), slider),
      h('label', { class: 'row' }, h('span', { class: 'grow' }, h('b', null, 'Allow messages'), h('div', { class: 'hint' }, 'Only with people you both follow, and always same gender')), h('span', { class: 'toggle' }, dms, h('span'))),
      h('div', null, h('div', { class: 'section-title' }, `Waiting for your approval (${c.pending.length})`),
        c.pending.length ? c.pending.map((p) => h('div', { class: 'card pad stack', style: { boxShadow: 'none', marginBottom: '8px' } },
          h('div', { class: 'post-body', style: { margin: 0 } }, p.body),
          p.image ? h('div', { class: 'post-img' }, h('img', { src: p.image, alt: '' })) : null,
          h('div', { class: 'row' }, h('span', { class: 'small muted grow' }, timeAgo(p.createdAt)),
            h('button', { class: 'btn btn-sm', onclick: async () => { await api('POST', `/api/family/posts/${p.id}/reject`); route(); } }, 'Decline'),
            h('button', { class: 'btn btn-sm btn-primary', onclick: async () => { await api('POST', `/api/family/posts/${p.id}/approve`); toast('Approved'); route(); } }, 'Approve')))) : h('p', { class: 'muted small', style: { margin: 0 } }, 'Nothing waiting.')),
      c.following.length ? h('div', null, h('div', { class: 'section-title' }, 'Follows'), h('div', { class: 'row wrap' }, c.following.map((u) => h('a', { class: 'chip', href: `#/u/${u.username}` }, u.displayName)))) : null));
  }

  const form = () => {
    const f = {
      displayName: h('input', { class: 'input', maxlength: 40 }),
      username: h('input', { class: 'input', maxlength: 20, autocapitalize: 'off' }),
      password: h('input', { class: 'input', type: 'password', minlength: 8 }),
      birthYear: h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: String(new Date().getFullYear() - 10) }),
    };
    const er = h('div', { class: 'error hidden' });
    const g = genderPick('child');
    const close = modal('Add a child account', h('div', { class: 'stack' },
      h('div', { class: 'notice' }, '🛡️', h('span', null, "Child accounts: you approve every post, set a daily time limit, messages are off by default, and they can't be found in search.")),
      h('div', { class: 'field' }, h('label', null, "Child's name"), f.displayName),
      h('div', { class: 'field' }, h('label', null, 'Username'), f.username),
      h('div', { class: 'field' }, h('label', null, 'Password'), f.password),
      h('div', { class: 'field' }, h('label', null, 'Birth year'), f.birthYear),
      g.el, er,
      h('button', { class: 'btn btn-primary btn-block', onclick: async () => {
        try {
          await api('POST', '/api/family/children', { displayName: f.displayName.value, username: f.username.value, password: f.password.value, birthYear: +f.birthYear.value, gender: g.value(), dailyLimitMin: 60 });
          close(); toast('Child account created'); route();
        } catch (e) { er.textContent = e.message; er.classList.remove('hidden'); }
      } }, 'Create account')));
  };
  root.append(
    h('p', { class: 'muted', style: { marginTop: '-8px' } }, 'Give your children a safe space to learn and share, with you in control.'),
    kids,
    h('button', { class: 'btn btn-primary', style: { marginTop: '14px' }, onclick: form }, icon('plus'), 'Add a child account'),
    !data.children.length ? h('div', { class: 'card empty', style: { marginTop: '14px' } }, h('div', { class: 'big' }, '👨‍👩‍👧'), h('p', null, 'No child accounts yet.')) : null);
}

function genderPick(prefix) {
  const el = h('div', { class: 'gender-pick' },
    h('input', { type: 'radio', name: `${prefix}-g`, id: `${prefix}-m`, value: 'male' }), h('label', { for: `${prefix}-m` }, '🧔 Brother', h('small', null, 'Male')),
    h('input', { type: 'radio', name: `${prefix}-g`, id: `${prefix}-f`, value: 'female' }), h('label', { for: `${prefix}-f` }, '🧕 Sister', h('small', null, 'Female')));
  return { el, value: () => el.querySelector('input:checked')?.value };
}

// ---------------------------------------------------------------- moderation
async function viewMod(root) {
  const { pending, reports } = await api('GET', '/api/mod/queue');
  const act = async (url, action) => { await api('POST', url, { action }); toast('Done'); route(); };
  root.append(h('h1', { class: 'page-title' }, 'Moderation'),
    h('div', { class: 'notice', style: { marginBottom: '14px' } }, '🛡️', h('span', null, `You only ever see content from the ${side()} side. ${Side()} moderate ${side()}.`)),
    h('div', { class: 'section-title' }, `Awaiting review (${pending.length})`),
    h('div', { class: 'feed' }, pending.length ? pending.map((p) => h('div', { class: 'card pad stack' },
      h('div', { class: 'row' }, avatar(p.author, 'sm'), h('b', { class: 'grow post-name' }, nameLine(p.author)), h('span', { class: 'small muted' }, timeAgo(p.createdAt))),
      h('div', { class: 'post-body', style: { margin: 0 } }, p.body),
      p.image ? h('div', { class: 'post-img' }, h('img', { src: p.image, alt: '' })) : null,
      h('div', { class: 'status-banner', style: { margin: 0 } }, p.reason),
      h('div', { class: 'row' }, h('span', { class: 'grow' }),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => act(`/api/mod/posts/${p.id}`, 'hide') }, 'Remove'),
        h('button', { class: 'btn btn-sm btn-primary', onclick: () => act(`/api/mod/posts/${p.id}`, 'approve') }, 'Approve')))) : h('div', { class: 'card empty' }, h('p', null, 'Queue is clear. Alhamdulillah.'))),
    h('div', { class: 'section-title', style: { marginTop: '22px' } }, `Reports (${reports.length})`),
    h('div', { class: 'feed' }, reports.length ? reports.map((r) => h('div', { class: 'card pad stack' },
      h('div', { class: 'row' }, avatar(r.author, 'sm'), h('b', { class: 'grow post-name' }, nameLine(r.author)), h('span', { class: 'kind-tag' }, r.commentId ? 'Comment' : 'Post')),
      h('div', { class: 'post-body', style: { margin: 0 } }, r.body),
      h('div', { class: 'status-banner', style: { margin: 0 } }, `Reason: ${r.reason}`),
      h('div', { class: 'row' }, h('span', { class: 'grow' }),
        h('button', { class: 'btn btn-sm', onclick: () => act(`/api/mod/reports/${r.id}`, 'dismiss') }, 'Dismiss'),
        h('button', { class: 'btn btn-sm btn-danger', onclick: () => act(`/api/mod/reports/${r.id}`, 'remove') }, 'Remove content')))) : h('div', { class: 'card empty' }, h('p', null, 'No open reports.'))));
}

// ---------------------------------------------------------------- settings
async function viewSettings(root) {
  const me = state.me;
  const name = h('input', { class: 'input', value: me.displayName, maxlength: 40 });
  const bio = h('textarea', { class: 'input', maxlength: 160, rows: 3 }, me.bio);
  const hue = h('input', { type: 'range', min: 0, max: 359, value: me.avatarHue });
  const prev = h('div');
  const drawPrev = () => prev.replaceChildren(avatar({ ...me, avatarHue: +hue.value, displayName: name.value || me.displayName }, 'lg'));
  hue.addEventListener('input', drawPrev); name.addEventListener('input', drawPrev); drawPrev();
  const salah = h('input', { type: 'checkbox', checked: me.salahPause });
  const limit = h('select', { class: 'input', disabled: me.isChild }, [0, 15, 30, 45, 60, 90, 120].map((m) => h('option', { value: m, selected: m === me.dailyLimitMin }, m ? `${m} minutes a day` : 'No limit')));
  const method = h('select', { class: 'input' }, Object.entries(Prayer.METHODS).map(([k, v]) => h('option', { value: k, selected: k === state.prayerOpts.method }, v.name)));
  const asr = h('select', { class: 'input' }, h('option', { value: 'shafi', selected: state.prayerOpts.asr === 'shafi' }, "Shafi'i, Maliki, Hanbali"), h('option', { value: 'hanafi', selected: state.prayerOpts.asr === 'hanafi' }, 'Hanafi'));
  const theme = h('select', { class: 'input', onchange: () => { store.set('theme', theme.value); applyTheme(); } },
    ['system', 'light', 'dark'].map((t) => h('option', { value: t, selected: store.get('theme', 'system') === t }, t[0].toUpperCase() + t.slice(1))));
  const er = h('div', { class: 'error hidden' });
  const save = async () => {
    er.classList.add('hidden');
    try {
      const body = { displayName: name.value, bio: bio.value, avatarHue: +hue.value, salahPause: salah.checked };
      if (!me.isChild) body.dailyLimitMin = +limit.value;
      state.me = (await api('PATCH', '/api/me', body)).user;
      state.prayerOpts = { method: method.value, asr: asr.value };
      store.set('prayerOpts', state.prayerOpts);
      toast('Saved'); renderChrome();
    } catch (e) { er.textContent = e.message; er.classList.remove('hidden'); }
  };
  root.append(h('h1', { class: 'page-title' }, 'Settings'), h('div', { class: 'stack' },
    h('section', { class: 'card pad stack' },
      h('div', { class: 'section-title', style: { margin: 0 } }, 'Profile'),
      h('div', { class: 'hue-preview' }, prev, h('div', { class: 'grow field' }, h('label', null, 'Avatar colour'), hue, h('div', { class: 'hint' }, 'Sakinah uses geometric avatars — no profile photos, for everyone’s modesty and safety.'))),
      h('div', { class: 'field' }, h('label', null, 'Display name'), name),
      h('div', { class: 'field' }, h('label', null, 'Bio'), bio),
      h('div', { class: 'hint' }, `Account side: ${Side()} — this is fixed and cannot be changed.`)),
    h('section', { class: 'card pad stack' },
      h('div', { class: 'section-title', style: { margin: 0 } }, 'Healthy use'),
      h('label', { class: 'row' }, h('span', { class: 'grow' }, h('b', null, 'Salah pause'), h('div', { class: 'hint' }, 'Pause the feed for 15 minutes at each adhan time')), h('span', { class: 'toggle' }, salah, h('span'))),
      h('div', { class: 'field' }, h('label', null, 'Daily reminder'), limit, me.isChild ? h('div', { class: 'hint' }, 'Your parent manages your time.') : h('div', { class: 'hint' }, 'We will gently remind you when you reach it.'))),
    h('section', { class: 'card pad stack' },
      h('div', { class: 'section-title', style: { margin: 0 } }, 'Prayer times'),
      h('div', { class: 'row' }, h('span', { class: 'grow' }, `📍 ${location_().label}`), h('button', { class: 'btn btn-sm', onclick: askLocation }, 'Use my location')),
      h('div', { class: 'field' }, h('label', null, 'Calculation method'), method),
      h('div', { class: 'field' }, h('label', null, 'Asr'), asr)),
    h('section', { class: 'card pad stack' },
      h('div', { class: 'section-title', style: { margin: 0 } }, 'Appearance'),
      h('div', { class: 'field' }, h('label', null, 'Theme'), theme)),
    er,
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', onclick: save }, 'Save changes'), h('span', { class: 'grow' }),
      h('a', { class: 'btn btn-ghost', href: '#/about' }, 'Our principles'),
      h('button', { class: 'btn btn-danger', onclick: async () => { await api('POST', '/api/auth/logout'); state.me = null; location.hash = ''; render(); } }, 'Sign out'))));
}

function principles() {
  return [
    ['🚪', 'Complete separation', "Brothers and sisters are two separate communities. You will never see a post, comment, photo, name or profile from the other side — and nobody can message across. The only exceptions are verified news (for everyone) and verified scholars' religious talks (for sisters)."],
    ['🖼️', 'No haram content', 'Every post is screened. New images are checked by a same-gender moderator before they appear. Profanity, immodesty, gambling, intoxicants and dating are not allowed.'],
    ['👨‍👩‍👧', 'Built for families', 'Children get accounts from their parents, who approve their posts, set daily time and control messages. Children cannot be found in search.'],
    ['🕌', 'Deen first', 'Prayer times, Qibla, a private deed tracker, tasbih, and a feed that pauses at adhan.'],
    ['⏳', 'Your time is an amanah', 'No endless scroll trap: the feed ends, nudges you to take a break, and respects daily limits.'],
    ['🤐', 'Good speech', 'No backbiting, slander or gossip. Report anything harmful — moderators act quickly.'],
  ];
}
function viewAbout(root) {
  root.append(backBar('Our principles'), h('div', { class: 'stack' }, principles().map(([e, t, d]) => h('section', { class: 'card pad row', style: { alignItems: 'flex-start' } }, h('div', { style: { fontSize: '28px' } }, e), h('div', null, h('b', null, t), h('p', { style: { margin: '4px 0 0' }, class: 'muted' }, d))))));
}

// ---------------------------------------------------------------- auth
function viewAuth() {
  const app = $('#app');
  let mode = 'login';
  const panel = h('div', { class: 'auth-box' });
  const draw = () => {
    const er = h('div', { class: 'error hidden' });
    const showErr = (m) => { er.textContent = m; er.classList.remove('hidden'); };
    if (mode === 'login') {
      const u = h('input', { class: 'input', autocomplete: 'username', autocapitalize: 'off' });
      const p = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
      const login = async (username, password) => {
        try { const r = await api('POST', '/api/auth/login', { username, password }); state.me = r.user; location.hash = '#/home'; render(); } catch (e) { showErr(e.message); }
      };
      panel.replaceChildren(
        h('h2', { style: { margin: '0 0 4px', fontSize: '26px' } }, 'Assalamu alaykum'),
        h('p', { class: 'muted', style: { marginTop: 0 } }, 'Welcome back to Sakinah.'),
        h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); login(u.value, p.value); } },
          h('div', { class: 'field' }, h('label', null, 'Username'), u),
          h('div', { class: 'field' }, h('label', null, 'Password'), p), er,
          h('button', { class: 'btn btn-primary btn-block' }, 'Sign in')),
        h('p', { class: 'muted', style: { textAlign: 'center' } }, 'New here? ', h('a', { href: '#', style: { color: 'var(--brand)', fontWeight: 700 }, onclick: (e) => { e.preventDefault(); mode = 'signup'; draw(); } }, 'Create an account')),
        h('div', { class: 'card pad stack', style: { boxShadow: 'none' } },
          h('div', { class: 'section-title', style: { margin: 0 } }, 'Try the demo'),
          h('div', { class: 'demo-list' }, [['omar_k', 'Brother'], ['sara_m', 'Sister'], ['yahya_k', 'Child'], ['ustadh_ahmad', 'Scholar'], ['mod_sisters', 'Moderator']]
            .map(([n, l]) => h('button', { class: 'chip', onclick: () => login(n, 'bismillah123') }, `${l} · ${n}`))),
          h('div', { class: 'hint' }, 'Sign in as a brother and a sister in two browsers to see that the two communities never meet.')));
    } else {
      const f = {
        displayName: h('input', { class: 'input', maxlength: 40, autocomplete: 'name' }),
        username: h('input', { class: 'input', maxlength: 20, autocapitalize: 'off', autocomplete: 'username' }),
        password: h('input', { class: 'input', type: 'password', autocomplete: 'new-password' }),
        birthYear: h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: 'e.g. 1995' }),
      };
      const pledge = h('input', { type: 'checkbox' });
      const g = genderPick('su');
      panel.replaceChildren(
        h('h2', { style: { margin: '0 0 4px', fontSize: '26px' } }, 'Join Sakinah'),
        h('p', { class: 'muted', style: { marginTop: 0 } }, 'A calm, halal place to connect.'),
        h('form', { class: 'stack', onsubmit: async (e) => {
          e.preventDefault();
          try {
            const r = await api('POST', '/api/auth/signup', { displayName: f.displayName.value, username: f.username.value, password: f.password.value, birthYear: +f.birthYear.value, gender: g.value(), pledge: pledge.checked });
            state.me = r.user; location.hash = '#/home'; render(); toast(`Welcome to Sakinah, ${r.user.displayName}! 🌙`);
          } catch (er2) { showErr(er2.message); }
        } },
        h('div', { class: 'field' }, h('label', null, 'I am a'), g.el, h('div', { class: 'hint' }, 'This decides which community you join and can never be changed.')),
        h('div', { class: 'field' }, h('label', null, 'Name'), f.displayName),
        h('div', { class: 'field' }, h('label', null, 'Username'), f.username),
        h('div', { class: 'field' }, h('label', null, 'Password (8+ characters)'), f.password),
        h('div', { class: 'field' }, h('label', null, 'Birth year'), f.birthYear, h('div', { class: 'hint' }, 'Under 16? A parent creates your account from their Family page.')),
        h('div', { class: 'pledge' }, h('b', null, 'The Sakinah adab pledge'),
          h('ul', null, h('li', null, 'I will speak good or remain silent'), h('li', null, 'I will not share haram or immodest content'), h('li', null, 'I will not backbite, slander or spread rumours'), h('li', null, 'I will not try to contact the opposite gender')),
          h('label', { class: 'row' }, pledge, 'I promise, in shā’ Allāh')),
        er,
        h('button', { class: 'btn btn-primary btn-block' }, 'Create account')),
        h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Already a member? ', h('a', { href: '#', style: { color: 'var(--brand)', fontWeight: 700 }, onclick: (e) => { e.preventDefault(); mode = 'login'; draw(); } }, 'Sign in')));
    }
  };
  draw();
  app.replaceChildren(h('div', { class: 'auth' },
    h('section', { class: 'auth-hero' },
      logo(),
      h('h1', null, 'The social network you can ', h('em', null, 'trust in your home'), '.'),
      h('p', null, 'Share reminders, learn from scholars, keep up with the Ummah and grow your deen — with brothers and sisters kept completely separate, and nothing haram in sight.'),
      h('div', { class: 'pillars' },
        h('div', null, h('b', null, '🚪 Fully segregated'), 'Brothers and sisters never see or message each other.'),
        h('div', null, h('b', null, '🛡️ Zero haram'), 'Screened posts, moderated images, no photos of people as avatars.'),
        h('div', null, h('b', null, '👨‍👩‍👧 Family-safe'), 'Parent-approved child accounts with time limits.'),
        h('div', null, h('b', null, '🕌 Deen-centred'), 'Prayer times, Qibla, tasbih, deed streaks.'))),
    h('section', { class: 'auth-panel' }, panel)));
}

// ---------------------------------------------------------------- overlays: salah pause & time limit
function showTimeUp() {
  if ($('.fullscreen.timeup')) return;
  document.body.append(h('div', { class: 'fullscreen timeup' }, h('div', null,
    h('div', { class: 'ar' }, 'وَٱلْعَصْرِ'),
    h('h2', null, "That's all for today"),
    h('p', null, 'You’ve used your Sakinah time for today. Your Deen tab is still open — prayer times, tasbih and your deeds.'),
    h('a', { class: 'btn btn-gold', href: '#/deen', onclick: () => $('.fullscreen.timeup')?.remove() }, 'Go to Deen'))));
}

function checkSalahPause() {
  if (!state.me?.salahPause || !location.hash.match(/^#\/(home|post|circle|u\/)|^$|^#\/$/)) return;
  const { lat, lng } = location_();
  const st = Prayer.status(new Date(), lat, lng, state.prayerOpts);
  if (!st.current) return;
  const since = Date.now() - st.currentAt;
  const key = `${localDay()}-${st.current}`;
  if (since < 0 || since > 15 * 60000 || store.get('salahDismissed', '') === key || $('.fullscreen.salah')) return;
  const close = () => { store.set('salahDismissed', key); $('.fullscreen.salah')?.remove(); };
  document.body.append(h('div', { class: 'fullscreen salah' }, h('div', null,
    h('div', { class: 'ar' }, 'حَيَّ عَلَى ٱلصَّلَاةِ'),
    h('div', { style: { opacity: 0.85 } }, 'Come to prayer'),
    h('h2', null, `It's time for ${Prayer.NAMES[st.current]}`),
    h('p', null, 'The feed is paused for a few minutes. It will be right here when you get back.'),
    h('button', { class: 'btn btn-gold', onclick: async () => {
      close();
      try { await api('POST', '/api/deeds', { day: localDay(), key: st.current, done: true }); toast(`${Prayer.NAMES[st.current]} logged — may Allah accept it 🤲`); } catch { /* ignore */ }
    } }, "I've prayed ✓"),
    h('button', { class: 'btn btn-ghost', onclick: close }, 'Dismiss'))));
}

let warnedLimit = false;
async function ping() {
  if (!state.me || document.visibilityState !== 'visible') return;
  try {
    const r = await api('POST', '/api/me/ping', { day: localDay() });
    if (r.locked) showTimeUp();
    else if (r.overLimit && !warnedLimit) { warnedLimit = true; toast(`You've reached your ${r.limitMin}-minute daily goal. Time for a break? 🌿`); }
  } catch { /* offline */ }
}

// ---------------------------------------------------------------- chrome + router
let cleanup = [];
const NAV = [
  ['home', 'Home', '#/home'], ['circles', 'Circles', '#/circles'], ['deen', 'Deen', '#/deen'],
  ['message', 'Messages', '#/messages'], ['bell', 'Notifications', '#/notifications'],
];

function renderChrome() {
  const me = state.me;
  const current = location.hash.split('/')[1] || 'home';
  const active = (href) => href.split('/')[1] === current || (current === 'circle' && href === '#/circles') || (current === 'post' && href === '#/home');
  const badge = (name) => (name === 'message' && state.unread.messages ? h('span', { class: 'badge' }, state.unread.messages)
    : name === 'bell' && state.unread.notifications ? h('span', { class: 'badge' }, state.unread.notifications) : null);
  const extra = [
    ['search', 'Discover', '#/search'],
    ['user', 'Profile', `#/u/${me.username}`],
    me.gender !== 'none' ? ['family', 'Family', '#/family'] : null,
    me.isModerator ? ['shield', 'Moderation', '#/mod'] : null,
    ['settings', 'Settings', '#/settings'],
  ].filter(Boolean);
  $('#side').replaceChildren(
    h('a', { href: '#/home' }, logo()),
    [...NAV, ...extra].map(([ic, label, href]) => h('a', { class: `nav-link ${active(href) ? 'active' : ''}`, href }, icon(ic), label, badge(ic))),
    h('button', { class: 'btn btn-primary btn-compose', onclick: () => composer({ onPosted: () => route() }) }, icon('plus'), 'Create post'),
    h('div', { class: 'side-foot' }, h('div', { class: 'row' }, avatar(me, 'sm'), h('div', { class: 'grow' }, h('b', { class: 'small' }, me.displayName), h('div', null, `${Side()} community`)))));
  $('#topbar').replaceChildren(
    h('a', { href: '#/home' }, logo()),
    h('a', { class: 'icon-btn', href: '#/search', 'aria-label': 'Discover' }, icon('search')),
    h('a', { class: 'icon-btn', href: '#/notifications', 'aria-label': 'Notifications' }, icon('bell'), badge('bell')),
    h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Settings' }, icon('settings')));
  $('#bottomnav').replaceChildren(...[['home', 'Home', '#/home'], ['circles', 'Circles', '#/circles'], ['deen', 'Deen', '#/deen'], ['message', 'Messages', '#/messages'], ['user', 'Me', `#/u/${me.username}`]]
    .map(([ic, label, href]) => h('a', { class: active(href) ? 'active' : '', href }, icon(ic), label, badge(ic))));
}

async function renderRail() {
  const rail = $('#rail');
  if (!rail || getComputedStyle(rail).display === 'none') return;
  rail.replaceChildren(prayerCard({ compact: true }));
  try {
    const [{ users }, daily] = await Promise.all([api('GET', '/api/suggestions'), api('GET', `/api/daily?day=${localDay()}`)]);
    rail.append(
      h('section', { class: 'card pad stack' }, h('div', { class: 'section-title', style: { margin: 0 } }, 'Hadith of the day'), h('div', null, `“${daily.hadith.en}”`), h('div', { class: 'small muted' }, daily.hadith.ref)),
      users.length ? h('section', { class: 'card pad' }, h('div', { class: 'section-title' }, 'Who to follow'), users.map(userRow)) : null,
      h('section', { class: 'card pad small muted' }, `🔒 You're in the ${Side()} community. Everything you see here was written by ${side()}, verified scholars or verified news.`));
  } catch { /* ignore */ }
}

async function refreshBadges() {
  if (!state.me) return;
  try {
    const r = await api('GET', '/api/me');
    state.me = r.user;
    const changed = r.unread.messages !== state.unread.messages || r.unread.notifications !== state.unread.notifications;
    state.unread = r.unread;
    if (changed) renderChrome();
  } catch { /* ignore */ }
}

async function route() {
  if (!state.me) return viewAuth();
  cleanup.forEach((f) => { try { f(); } catch { /* ignore */ } });
  cleanup = [];
  const [, name = 'home', a, b] = location.hash.split('/');
  renderChrome();
  const root = h('div', { class: 'view' });
  $('#main').replaceChildren(root);
  window.scrollTo(0, 0);
  const views = {
    home: () => viewHome(root, a || 'foryou'),
    post: () => viewPost(root, a),
    u: () => viewProfile(root, decodeURIComponent(a || state.me.username)),
    messages: () => (a ? viewChat(root, decodeURIComponent(a)) : viewMessages(root)),
    circles: () => viewCircles(root),
    circle: () => viewCircle(root, a),
    deen: () => viewDeen(root),
    notifications: () => viewNotifications(root),
    search: () => viewSearch(root, b),
    family: () => viewFamily(root),
    mod: () => viewMod(root),
    settings: () => viewSettings(root),
    about: () => viewAbout(root),
  };
  try {
    await (views[name] || views.home)();
  } catch (e) {
    if (e.status === 423) return;
    root.replaceChildren(h('div', { class: 'card empty' }, h('div', { class: 'big' }, '🌫️'), h('p', null, e.status === 404 ? 'This page does not exist.' : e.message), h('a', { class: 'btn', href: '#/home' }, 'Go home')));
  }
  checkSalahPause();
}

function applyTheme() {
  const t = store.get('theme', 'system');
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

async function render() {
  applyTheme();
  const app = $('#app');
  if (!state.me) return viewAuth();
  app.replaceChildren(
    h('header', { class: 'topbar', id: 'topbar' }),
    h('div', { class: 'shell' }, h('nav', { class: 'side', id: 'side', 'aria-label': 'Main' }), h('main', { class: 'main', id: 'main' }), h('aside', { class: 'rail', id: 'rail' })),
    h('nav', { class: 'bottomnav', id: 'bottomnav', 'aria-label': 'Main' }),
    h('button', { class: 'fab', 'aria-label': 'Create post', onclick: () => composer({ onPosted: () => route() }) }, icon('plus')));
  await route();
  renderRail();
  refreshBadges();
}

async function boot() {
  applyTheme();
  try {
    const r = await api('GET', '/api/me');
    state.me = r.user;
    state.unread = r.unread;
  } catch { state.me = null; }
  await render();
  window.addEventListener('hashchange', () => route());
  setInterval(refreshBadges, 20000);
  setInterval(ping, 60000);
  setInterval(checkSalahPause, 30000);
  setTimeout(ping, 3000);
}
boot();
