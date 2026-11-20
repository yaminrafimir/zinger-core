'use strict';
/**
 * Daily reminders. Translations follow the meaning of well-known renderings
 * (Sahih International for Qur'an). Have a qualified scholar review this list
 * before launch, and extend it — it rotates by day of year.
 */

const AYAT = [
  { ar: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا', en: 'Allah does not burden a soul beyond that it can bear.', ref: 'Al-Baqarah 2:286' },
  { ar: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا • إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا', en: 'For indeed, with hardship comes ease. Indeed, with hardship comes ease.', ref: 'Ash-Sharh 94:5–6' },
  { ar: 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ', en: 'Unquestionably, by the remembrance of Allah hearts are assured.', ref: "Ar-Ra'd 13:28" },
  { ar: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ', en: 'So remember Me; I will remember you.', ref: 'Al-Baqarah 2:152' },
  { ar: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ', en: 'And whoever relies upon Allah — then He is sufficient for him.', ref: 'At-Talaq 65:3' },
  { ar: 'قُل لِّلْمُؤْمِنِينَ يَغُضُّوا۟ مِنْ أَبْصَٰرِهِمْ', en: 'Tell the believing men to lower their gaze and guard their private parts. That is purer for them.', ref: 'An-Nur 24:30' },
  { ar: 'إِنَّ أَكْرَمَكُمْ عِندَ ٱللَّهِ أَتْقَىٰكُمْ', en: 'Indeed, the most noble of you in the sight of Allah is the most righteous of you.', ref: 'Al-Hujurat 49:13' },
  { ar: 'ٱجْتَنِبُوا۟ كَثِيرًا مِّنَ ٱلظَّنِّ', en: 'Avoid much suspicion… and do not spy or backbite one another.', ref: 'Al-Hujurat 49:12' },
  { ar: 'وَبِٱلْوَٰلِدَيْنِ إِحْسَٰنًا', en: 'And your Lord has decreed that you worship none but Him, and that you be good to your parents.', ref: "Al-Isra' 17:23" },
  { ar: 'وَقُولُوا۟ لِلنَّاسِ حُسْنًا', en: 'And speak to people good words.', ref: 'Al-Baqarah 2:83' },
  { ar: 'إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ', en: 'Indeed, Allah is with the patient.', ref: 'Al-Baqarah 2:153' },
  { ar: 'وَلَا تَقْفُ مَا لَيْسَ لَكَ بِهِۦ عِلْمٌ', en: 'And do not pursue that of which you have no knowledge.', ref: "Al-Isra' 17:36" },
];

const AHADITH = [
  { en: 'Actions are only by intentions, and every person will have only what they intended.', ref: 'Sahih al-Bukhari 1, Sahih Muslim 1907' },
  { en: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.', ref: 'Sahih al-Bukhari 6018, Sahih Muslim 47' },
  { en: 'None of you truly believes until he loves for his brother what he loves for himself.', ref: 'Sahih al-Bukhari 13, Sahih Muslim 45' },
  { en: "Part of the excellence of a person's Islam is leaving what does not concern him.", ref: "Jami' at-Tirmidhi 2317" },
  { en: 'The strong one is not the one who overcomes people; the strong one is the one who controls himself when angry.', ref: 'Sahih al-Bukhari 6114, Sahih Muslim 2609' },
  { en: 'Your smiling in the face of your brother is charity.', ref: "Jami' at-Tirmidhi 1956" },
  { en: 'The most beloved deeds to Allah are those done consistently, even if they are small.', ref: 'Sahih al-Bukhari 6464, Sahih Muslim 783' },
  { en: 'The best of you are those who learn the Qur\'an and teach it.', ref: 'Sahih al-Bukhari 5027' },
  { en: 'Allah does not look at your appearance or your wealth, but He looks at your hearts and your deeds.', ref: 'Sahih Muslim 2564' },
  { en: 'Make things easy and do not make them difficult; give glad tidings and do not drive people away.', ref: 'Sahih al-Bukhari 69, Sahih Muslim 1734' },
];

// Private deed tracker. Points ("hasanat" score) are a personal motivator only —
// never shown to others, so there is no showing off (riya).
const DEEDS = [
  { key: 'fajr', label: 'Fajr', group: 'Salah', points: 10 },
  { key: 'dhuhr', label: 'Dhuhr', group: 'Salah', points: 10 },
  { key: 'asr', label: 'Asr', group: 'Salah', points: 10 },
  { key: 'maghrib', label: 'Maghrib', group: 'Salah', points: 10 },
  { key: 'isha', label: 'Isha', group: 'Salah', points: 10 },
  { key: 'quran', label: "Read Qur'an", group: 'Worship', points: 15 },
  { key: 'adhkar_morning', label: 'Morning adhkar', group: 'Worship', points: 5 },
  { key: 'adhkar_evening', label: 'Evening adhkar', group: 'Worship', points: 5 },
  { key: 'sadaqah', label: 'Gave sadaqah', group: 'Character', points: 10 },
  { key: 'parents', label: 'Helped my parents', group: 'Character', points: 10 },
  { key: 'kindness', label: 'A kind word to someone', group: 'Character', points: 5 },
];

function dayIndex(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return Math.floor(d.getTime() / 86400000);
}

function dailyFor(date) {
  const i = dayIndex(date);
  return { ayah: AYAT[i % AYAT.length], hadith: AHADITH[i % AHADITH.length] };
}

module.exports = { AYAT, AHADITH, DEEDS, dailyFor };
