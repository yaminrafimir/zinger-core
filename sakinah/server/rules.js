'use strict';
/**
 * Sakinah segregation policy — the single source of truth.
 *
 * Every query, endpoint and notification goes through these functions.
 * The model: to a viewer, accounts of the opposite gender DO NOT EXIST,
 * with exactly two narrow exceptions for verified public channels:
 *
 *   - Brothers may see verified NEWS channels presented by sisters.
 *   - Sisters may see verified NEWS channels and verified SCHOLARS (religious talks)
 *     presented by brothers.
 *
 * Organisation channels with no presenter (gender 'none') are visible to all.
 * Ordinary members are never visible across genders: not their posts, comments,
 * reactions, follower entries, search results or profiles. Direct messages are
 * same-gender only, with no exceptions.
 */

const GENDERS = ['male', 'female'];
const KINDS = ['member', 'scholar', 'news', 'moderator'];

// Which verified channel kinds a viewer may see across genders.
const CROSS_GENDER_KINDS = Object.freeze({
  male: Object.freeze(['news']),
  female: Object.freeze(['news', 'scholar']),
});

function crossKindsFor(viewer) {
  return CROSS_GENDER_KINDS[viewer && viewer.gender] || [];
}

/** May `viewer` see anything authored by `author` (post, comment, reaction, profile)? */
function canSeeAuthor(viewer, author) {
  if (!viewer || !author) return false;
  if (viewer.id === author.id) return true;
  if (author.gender === 'none') return !!author.verified; // presenter-less org channel
  if (viewer.gender === 'none') return false;              // channels don't browse members
  if (author.gender === viewer.gender) return true;
  return !!author.verified && crossKindsFor(viewer).includes(author.kind);
}

/**
 * SQL equivalent of canSeeAuthor, for filtering inside queries (so pagination and
 * counts never leak). `alias` is the users-table alias. Values are whitelisted,
 * never user-supplied strings.
 */
function visibleAuthorSql(viewer, alias = 'u') {
  if (!/^[a-z_]+$/.test(alias)) throw new Error('bad alias');
  const id = Number(viewer.id) | 0;
  const parts = [`${alias}.id = ${id}`, `(${alias}.gender = 'none' AND ${alias}.verified = 1)`];
  if (GENDERS.includes(viewer.gender)) {
    parts.push(`${alias}.gender = '${viewer.gender}'`);
    const kinds = crossKindsFor(viewer).filter((k) => KINDS.includes(k));
    if (kinds.length) {
      parts.push(`(${alias}.verified = 1 AND ${alias}.kind IN (${kinds.map((k) => `'${k}'`).join(',')}))`);
    }
  }
  return `(${parts.join(' OR ')})`;
}

/** Direct messages: same gender only, members/scholars/moderators, never news channels. */
function canMessage(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (!GENDERS.includes(a.gender) || a.gender !== b.gender) return false;
  if (a.kind === 'news' || b.kind === 'news') return false;
  return true;
}

/** Following is allowed only where the author would be visible anyway. */
function canFollow(viewer, target) {
  return !!viewer && !!target && viewer.id !== target.id && canSeeAuthor(viewer, target);
}

/** Circles (halaqahs) are single-gender spaces. */
function canAccessCircle(viewer, circle) {
  return !!viewer && !!circle && GENDERS.includes(viewer.gender) && circle.gender === viewer.gender;
}

/** Content is reviewed by moderators of the same gender as its author. */
function canModerate(moderator, author) {
  if (!moderator || moderator.kind !== 'moderator' || !author) return false;
  if (author.gender === 'none') return true;
  return moderator.gender === author.gender;
}

module.exports = {
  GENDERS,
  KINDS,
  CROSS_GENDER_KINDS,
  canSeeAuthor,
  visibleAuthorSql,
  canMessage,
  canFollow,
  canAccessCircle,
  canModerate,
};
