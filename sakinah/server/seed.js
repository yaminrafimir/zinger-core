'use strict';
const { hashPassword } = require('./app');

const PASSWORD = 'bismillah123';
const HOUR = 3600000;

/** Demo community. All people and channels are fictional. */
function seed(db) {
  const now = Date.now();
  const year = new Date().getUTCFullYear();
  const hash = hashPassword(PASSWORD); // same password for all demo accounts
  const ins = db.prepare(`INSERT INTO users (username, display_name, password_hash, gender, kind, verified, bio, avatar_hue,
      birth_year, guardian_id, dms_enabled, daily_limit_min, trusted, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const ids = {};
  const user = (username, name, gender, kind, verified, bio, hue, age, extra = {}) => {
    const r = ins.run(username, name, hash, gender, kind, verified ? 1 : 0, bio, hue, year - age,
      extra.guardian ? ids[extra.guardian] : null, extra.dms === false ? 0 : 1, extra.limit || 0, verified ? 1 : 0, now - 90 * 24 * HOUR);
    ids[username] = Number(r.lastInsertRowid);
  };

  // Brothers
  user('omar_k', 'Omar Khan', 'male', 'member', false, 'Father of two · Software engineer · Trying to be better every day', 150, 38);
  user('hamza_r', 'Hamza Rahman', 'male', 'member', false, "Hifdh student. Qur'an is the best company.", 30, 24);
  user('zaid_s', 'Zaid Saleh', 'male', 'member', false, 'Fajr club ☀️ · Gym · Halal food reviewer', 210, 29);
  // Sisters
  user('sara_m', 'Sara Malik', 'female', 'member', false, 'Mum of three · Homeschooling · Baking for the masjid', 330, 35);
  user('amina_h', 'Amina Hussain', 'female', 'member', false, 'Medical student 🩺 · Seerah lover', 280, 23);
  user('noor_a', 'Noor Ali', 'female', 'member', false, "Arabic teacher · Tajweed circles every Saturday", 190, 31);
  // Child account (guardian: omar_k)
  user('yahya_k', 'Yahya', 'male', 'member', false, 'Learning Juz Amma 📖', 100, 11, { guardian: 'omar_k', dms: false, limit: 45 });
  // Verified channels
  user('ustadh_ahmad', 'Ustadh Ahmad (Demo)', 'male', 'scholar', true, 'Weekly tafsir and fiqh of daily life. Questions welcome.', 160, 52);
  user('ustadha_fatimah', 'Ustadha Fatimah (Demo)', 'female', 'scholar', true, 'Sisters-only classes: fiqh, family and tazkiyah.', 300, 47);
  user('ummah_news', 'Ummah News Desk', 'none', 'news', true, 'Verified news for the Muslim world. Facts, not gossip.', 200, 40);
  user('sisters_news', 'Sakinah News — Sisters Desk', 'female', 'news', true, 'Community news presented by our sisters team.', 340, 40);
  user('brothers_news', 'Sakinah News — Brothers Desk', 'male', 'news', true, 'Community news presented by our brothers team.', 120, 40);
  // Moderators (each reviews only their own side)
  user('mod_brothers', 'Moderator (Brothers)', 'male', 'moderator', true, 'Keeping the brothers side clean and beneficial.', 0, 40);
  user('mod_sisters', 'Moderator (Sisters)', 'female', 'moderator', true, 'Keeping the sisters side clean and beneficial.', 0, 40);

  const post = db.prepare('INSERT INTO posts (author_id, circle_id, body, category, status, created_at) VALUES (?,?,?,?,?,?)');
  const P = {};
  const p = (key, author, hoursAgo, category, body, circle = null) => {
    P[key] = Number(post.run(ids[author], circle, body, category, 'published', now - hoursAgo * HOUR).lastInsertRowid);
  };

  p('n1', 'ummah_news', 2, 'news', 'Ramadan moon-sighting committees from 14 countries will meet next month to agree a shared approach to announcements. We will publish the outcome here as soon as it is official.');
  p('n2', 'sisters_news', 5, 'news', "Community update: the new women's wing of the city masjid opens this Friday with a dedicated entrance, prayer hall and a children's Qur'an corner.");
  p('n3', 'brothers_news', 9, 'news', 'Local food bank appeal: volunteers delivered 1,200 food parcels this week. Sign-up sheets for next weekend are at the masjid reception.');
  p('s1', 'ustadh_ahmad', 3, 'reminder', 'Before you open any app, ask yourself: will this bring me closer to Allah or further from Him? The Prophet ﷺ said: "Part of the excellence of a person\'s Islam is leaving what does not concern him." (Tirmidhi)');
  p('s2', 'ustadh_ahmad', 30, 'quran', "Tafsir note on Surah Al-Asr: Allah swears by time, then says all of humanity is in loss — except those who believe, do righteous deeds, and advise each other to truth and patience. Four conditions, one surah. Which one will you work on this week?");
  p('s3', 'ustadha_fatimah', 4, 'reminder', "Sisters, your home is a place of worship too. Every meal you prepare with the intention of pleasing Allah is written for you. Renew your intention tonight. 🤍");
  p('s4', 'ustadha_fatimah', 26, 'hadith', 'The Prophet ﷺ said: "The most beloved deeds to Allah are those done consistently, even if they are small." (Bukhari & Muslim). Two rak\'ah of Duha every day beats a burst of worship once a month.');

  p('b1', 'hamza_r', 1, 'quran', 'Alhamdulillah, just finished revising Surah Al-Mulk for the 40th time this month. Reminder: it intercedes for its companion until he is forgiven. Read it every night, brothers!');
  p('b2', 'zaid_s', 6, 'general', 'Fajr at the masjid with 30 brothers this morning, and breakfast after. If you are struggling with Fajr: sleep early, make wudu before bed, and ask a brother to call you. It works.');
  p('b3', 'omar_k', 12, 'question', 'Brothers with young kids: how do you teach them salah without making it feel like a chore? Mine are 6 and 11.');
  p('b4', 'zaid_s', 20, 'dua', 'Please make dua for my father, he has surgery tomorrow. May Allah grant him complete shifa.');
  p('b5', 'omar_k', 40, 'family', 'Weekend plan: picnic with the kids, Asr in the park, then we read the story of Prophet Yunus عليه السلام together. Simple days are the best days.');

  p('g1', 'amina_h', 2, 'reminder', 'Exams week, sisters. Make wudu before studying, start with Bismillah, and remember: your rizq, including your results, is already written. Do your best and leave the rest to Allah. 📚');
  p('g2', 'sara_m', 7, 'family', 'Made date-and-oat cookies with the kids for the masjid bake sale. Every cookie sold goes to the orphan fund. Bismillah! 🍪');
  p('g3', 'noor_a', 15, 'quran', "Tajweed tip: when you see a small meem above a noon saakinah or tanween, that's iqlab — turn the noon sound into a hidden meem with ghunnah. Practise with: مِنۢ بَعْدِ");
  p('g4', 'sara_m', 22, 'dua', 'Sisters, please make dua for my mother. She is unwell and in hospital. May Allah ease her pain.');
  p('g5', 'amina_h', 45, 'question', 'Which seerah book would you recommend for someone who has never read one? I am thinking The Sealed Nectar.');

  p('y1', 'yahya_k', 8, 'quran', 'I memorised Surah An-Naba today! 🎉 Abu said I can choose dinner.');

  // Reactions & comments (same-gender communities)
  const react = db.prepare('INSERT OR IGNORE INTO reactions (post_id, user_id, type, created_at) VALUES (?,?,?,?)');
  const R = (postKey, users, type) => users.forEach((u) => react.run(P[postKey], ids[u], type, now - HOUR));
  R('b1', ['omar_k', 'zaid_s', 'yahya_k'], 'mashallah');
  R('b2', ['omar_k', 'hamza_r'], 'jazakallah');
  R('b4', ['omar_k', 'hamza_r', 'yahya_k'], 'ameen');
  R('y1', ['omar_k', 'hamza_r', 'zaid_s'], 'mashallah');
  R('s1', ['omar_k', 'hamza_r', 'zaid_s', 'sara_m', 'amina_h'], 'jazakallah');
  R('n1', ['omar_k', 'sara_m', 'noor_a'], 'jazakallah');
  R('g1', ['sara_m', 'noor_a'], 'jazakallah');
  R('g2', ['amina_h', 'noor_a'], 'mashallah');
  R('g4', ['amina_h', 'noor_a'], 'ameen');
  R('s3', ['sara_m', 'amina_h', 'noor_a'], 'jazakallah');

  const com = db.prepare('INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)');
  const C = (postKey, u, body, h) => com.run(P[postKey], ids[u], body, now - h * HOUR);
  C('b3', 'zaid_s', 'Pray together as a family at least once a day and let them lead the iqamah. My nephew loves it.', 10);
  C('b3', 'hamza_r', 'Praise them a lot and keep it short in the beginning. Love first, rules later.', 9);
  C('b4', 'omar_k', 'Ameen. May Allah make it easy for him and for your family.', 18);
  C('y1', 'omar_k', 'So proud of you habibi! Pizza it is 🍕', 7);
  C('s1', 'omar_k', 'Needed this. JazakAllah khair Ustadh.', 2);
  C('s1', 'sara_m', 'Such a beneficial reminder, JazakAllah khair.', 2); // only sisters will see this one
  C('g4', 'noor_a', 'Ameen ya Rabb. Sending you and your mother lots of duas. 🤍', 20);
  C('g5', 'noor_a', 'The Sealed Nectar is a great start. "When the Moon Split" is also very readable.', 40);

  const follow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)');
  const F = (a, list) => list.forEach((b) => follow.run(ids[a], ids[b], now));
  F('omar_k', ['hamza_r', 'zaid_s', 'ustadh_ahmad', 'ummah_news', 'yahya_k']);
  F('hamza_r', ['omar_k', 'zaid_s', 'ustadh_ahmad']);
  F('zaid_s', ['omar_k', 'hamza_r', 'brothers_news']);
  F('yahya_k', ['omar_k', 'hamza_r']);
  F('sara_m', ['amina_h', 'noor_a', 'ustadha_fatimah', 'ustadh_ahmad', 'sisters_news']);
  F('amina_h', ['sara_m', 'noor_a', 'ustadha_fatimah']);
  F('noor_a', ['sara_m', 'amina_h']);

  const circle = db.prepare('INSERT INTO circles (name, description, gender, emoji, created_by, created_at) VALUES (?,?,?,?,?,?)');
  const member = db.prepare('INSERT INTO circle_members (circle_id, user_id) VALUES (?,?)');
  const mk = (name, desc, gender, emoji, owner, members) => {
    const id = Number(circle.run(name, desc, gender, emoji, ids[owner], now - 30 * 24 * HOUR).lastInsertRowid);
    [owner, ...members].forEach((m) => member.run(id, ids[m]));
    return id;
  };
  const fajr = mk('Fajr Risers', 'Wake each other up for Fajr. Check in every morning.', 'male', '☀️', 'zaid_s', ['omar_k', 'hamza_r']);
  mk('Dads of the Deen', 'Raising righteous kids in today’s world.', 'male', '👨‍👧', 'omar_k', ['zaid_s']);
  const tajweed = mk('Saturday Tajweed', 'Weekly tajweed practice and recitation feedback.', 'female', '📖', 'noor_a', ['amina_h', 'sara_m']);
  mk('Homeschooling Mums', 'Curricula, routines and support.', 'female', '🏡', 'sara_m', ['noor_a']);
  p('c1', 'hamza_r', 5, 'general', 'Up for Fajr ✅ 5:12am. Who else made it?', fajr);
  p('c2', 'zaid_s', 4, 'general', 'Alhamdulillah ✅ prayed at the masjid.', fajr);
  p('c3', 'noor_a', 30, 'quran', "This week's homework: Surah Al-Qadr. Record yourself and post here for feedback in shā' Allāh.", tajweed);

  // A message thread (same gender only)
  const msg = db.prepare('INSERT INTO messages (sender_id, recipient_id, body, created_at, read_at) VALUES (?,?,?,?,?)');
  msg.run(ids.zaid_s, ids.omar_k, 'Salam akhi, are you coming to the halaqah on Thursday?', now - 3 * HOUR, now - 2 * HOUR);
  msg.run(ids.omar_k, ids.zaid_s, "Wa alaykum salam! Yes in shā' Allāh, bringing Yahya too.", now - 2 * HOUR, now - HOUR);
  msg.run(ids.hamza_r, ids.omar_k, 'Assalamu alaykum, can you send me the tafsir notes from last week?', now - HOUR, null);
  msg.run(ids.amina_h, ids.sara_m, 'Salam sis! Saving two boxes of cookies for me? 😄', now - 4 * HOUR, null);

  const notif = db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id, text, created_at) VALUES (?,?,?,?,?,?)');
  notif.run(ids.omar_k, ids.zaid_s, 'comment', P.b3, 'Pray together as a family at least once a day…', now - 10 * HOUR);
  notif.run(ids.omar_k, ids.hamza_r, 'follow', null, '', now - 20 * HOUR);
  notif.run(ids.sara_m, ids.noor_a, 'comment', P.g4, 'Ameen ya Rabb…', now - 20 * HOUR);

  return ids;
}

module.exports = { seed, PASSWORD };
