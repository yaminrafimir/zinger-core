'use strict';
/* Prayer times (astronomical calculation, after the well-known PrayTimes method), Qibla and Hijri date. */
window.Prayer = (() => {
  const dtr = (d) => (d * Math.PI) / 180;
  const rtd = (r) => (r * 180) / Math.PI;
  const sin = (d) => Math.sin(dtr(d));
  const cos = (d) => Math.cos(dtr(d));
  const tan = (d) => Math.tan(dtr(d));
  const arcsin = (x) => rtd(Math.asin(x));
  const arccos = (x) => rtd(Math.acos(x));
  const arctan2 = (y, x) => rtd(Math.atan2(y, x));
  const arccot = (x) => rtd(Math.atan(1 / x));
  const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };

  const METHODS = {
    MWL: { name: 'Muslim World League', fajr: 18, isha: 17 },
    ISNA: { name: 'ISNA (North America)', fajr: 15, isha: 15 },
    Egypt: { name: 'Egyptian Authority', fajr: 19.5, isha: 17.5 },
    Makkah: { name: 'Umm al-Qura, Makkah', fajr: 18.5, ishaMinutes: 90 },
    Karachi: { name: 'University of Karachi', fajr: 18, isha: 18 },
  };
  const NAMES = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: arcsin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
  }

  /** Returns { fajr, sunrise, dhuhr, asr, maghrib, isha } as Date objects for the given local date. */
  function times(date, lat, lng, { method = 'MWL', asr = 'shafi' } = {}) {
    const m = METHODS[method] || METHODS.MWL;
    const tz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset() / 60;
    const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
    const midDay = (t) => fix(12 - sunPosition(jd + t).eqt, 24);
    const sunAngleTime = (angle, t, ccw) => {
      const { decl } = sunPosition(jd + t);
      const v = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (v < -1 || v > 1) return NaN;
      const T = arccos(v) / 15;
      return midDay(t) + (ccw ? -T : T);
    };
    const asrTime = (factor, t) => {
      const { decl } = sunPosition(jd + t);
      return sunAngleTime(-arccot(factor + tan(Math.abs(lat - decl))), t);
    };
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
    for (let i = 0; i < 2; i++) {
      const p = (k) => t[k] / 24;
      t = {
        fajr: sunAngleTime(m.fajr, p('fajr'), true),
        sunrise: sunAngleTime(0.833, p('sunrise'), true),
        dhuhr: midDay(p('dhuhr')),
        asr: asrTime(asr === 'hanafi' ? 2 : 1, p('asr')),
        maghrib: sunAngleTime(0.833, p('maghrib')),
        isha: m.ishaMinutes ? NaN : sunAngleTime(m.isha, p('isha')),
      };
      if (Object.values(t).some((v) => Number.isNaN(v))) {
        // high latitudes / Umm al-Qura: fall back to a portion of the night
        const night = 24 - (t.maghrib - t.sunrise);
        if (Number.isNaN(t.fajr)) t.fajr = t.sunrise - (night * m.fajr) / 60;
        if (Number.isNaN(t.isha)) t.isha = m.ishaMinutes ? t.maghrib + m.ishaMinutes / 60 : t.maghrib + (night * m.isha) / 60;
      }
    }
    const out = {};
    for (const k of ORDER) {
      const hours = t[k] + tz - lng / 15 + (k === 'dhuhr' ? 1 / 60 : 0);
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      d.setMinutes(Math.round(hours * 60));
      out[k] = d;
    }
    return out;
  }

  /** The prayer we are currently in and the next one (skips sunrise as a "current prayer"). */
  function status(now, lat, lng, opts) {
    const today = times(now, lat, lng, opts);
    const tomorrow = times(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), lat, lng, opts);
    let next = ORDER.find((k) => today[k] > now);
    const nextAt = next ? today[next] : tomorrow.fajr;
    if (!next) next = 'fajr';
    const salah = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const current = [...salah].reverse().find((k) => today[k] <= now) || null;
    return { today, next, nextAt, current, currentAt: current ? today[current] : null };
  }

  function qibla(lat, lng) {
    const kLat = 21.4225;
    const kLng = 39.8262;
    const y = sin(kLng - lng);
    const x = cos(lat) * tan(kLat) - sin(lat) * cos(kLng - lng);
    return fix(arctan2(y, x), 360);
  }

  function hijri(date) {
    try {
      return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    } catch {
      return '';
    }
  }

  const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return { times, status, qibla, hijri, fmt, METHODS, NAMES, ORDER };
})();
