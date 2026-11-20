# Sakinah · سَكِينَة

**The social network Muslim families can trust in their homes.**

Sakinah is a complete social network built on Islamic principles. Brothers and sisters are kept in two separate communities. There is nothing haram in the feed. Children get parent-controlled accounts. Prayer, Qur'an and good deeds are part of the app itself.

```bash
cd sakinah
npm start        # http://localhost:3000  (Node 22.13+, zero dependencies)
npm test         # 19 tests, including end-to-end segregation checks
npm run reset    # wipe the database and re-seed the demo community
```

Demo accounts all use the password `bismillah123`. They are `omar_k` (brother and parent), `sara_m` (sister), `yahya_k` (child, age 11), `ustadh_ahmad` (scholar), `ustadha_fatimah`, `ummah_news`, `mod_brothers` and `mod_sisters`. To see the separation in action, open a brother and a sister in two browsers.

## How segregation works

The whole policy lives in one file, [`server/rules.js`](server/rules.js). To a viewer, accounts of the opposite gender **do not exist**:

| Viewer  | Can see across the gender line |
|---------|---------------------------------|
| Brother | Verified **news** channels only |
| Sister  | Verified **news** channels and verified **scholars** (religious talks) |

Everything else is same-gender only, and the rule is enforced on the server, inside the SQL queries:

- **Posts, comments and reactions.** On a shared scholar or news post, brothers see only brothers' comments and reaction counts, and sisters see only sisters'.
- **Profiles, search, follows and notifications.** Opposite-gender users return `404`. They can't be found, followed or notified.
- **Direct messages.** Same gender only, with no exceptions. News channels can't be messaged.
- **Circles (halaqahs).** Single-gender groups, invisible to the other side.
- **Images.** Served only through an authorised endpoint. Even with the URL, a brother cannot load a sister's image.
- **Moderation.** Content is reviewed by moderators of the same gender as its author.
- **Gender.** Chosen once at signup and never editable. There are no profile photos anywhere; everyone gets a geometric avatar.

`test/rules.test.js` checks that the SQL filter matches the policy for every viewer/author pair. `test/api.test.js` logs in as brothers, sisters, a child and moderators through the real HTTP API and asserts that nothing crosses the line.

## Keeping it halal

- Text is screened for profanity, sexual content, gambling, intoxicants and dating. Those posts are rejected.
- Phone numbers, social handles, emails and outside links are held for review, so people can't move contact off the platform. Links to quran.com, sunnah.com and islamqa.info are allowed.
- New users' images wait for a same-gender moderator. Users become trusted after three approved images.
- When three community reports arrive, the post is hidden until a moderator decides.
- Reactions are *MashaAllah, JazakAllah, SubhanAllah* and *Ameen*. There is no "like" vanity.

## Family safety

- Under-16s cannot sign up on their own. A parent creates their account from the **Family** page.
- A child's posts wait for their parent's approval.
- Parents set a daily time limit, enforced on the server. When time is up, the Deen tab stays open.
- Messages are off by default. When turned on, children can message only mutual follows, always same gender.
- Children don't appear in search or "who to follow".

## Engaging, the beneficial way

People come back to Sakinah because it adds good to their day:

- A ranked "For you" feed, plus tabs for Following, Knowledge, Duas, Questions, News and Saved.
- An Ayah and Hadith of the day.
- Prayer times with a live countdown, Qibla direction and the Hijri date.
- A private deed tracker with streaks and points, and a tasbih counter with haptics. There are no public leaderboards, to avoid riya (showing off).
- Circles for Fajr check-ins, tajweed practice, parenting and more.
- Notifications and dua requests ("Ameen").

The feed deliberately avoids dark patterns:
- **Salah pause.** The feed pauses at each adhan.
- **Break cards.** Every 25 posts, a card suggests taking a break.
- **A real end.** "You're all caught up" points you to dhikr.
- **Daily goals.** Adults can set their own reminder.

This is what lets parents trust it.

## Before a real launch

- **Verify gender at signup.** Separation is only as strong as signup honesty. Add verification, for example a video check by a same-gender team, or vouching from a local masjid.
- **Add an image classifier** in front of human review. It should detect people and the opposite gender, and catch nudity.
- **Get scholarly review** of the policy table, the daily content (`server/content.js`) and the reaction wording.
- **Add blocking/muting, password reset, rate limiting at the proxy, HTTPS, and backups.** For scale, move from SQLite to Postgres.
- **Build native apps.** The web app already works as an installable PWA.

## Layout

```
server/rules.js       segregation policy (single source of truth)
server/app.js         HTTP API, auth, feed ranking, moderation, family controls
server/moderation.js  content screening
server/content.js     daily ayat/ahadith, deed list
server/seed.js        fictional demo community
public/               single-page client (vanilla JS, no build step)
test/                 node:test suites
```
