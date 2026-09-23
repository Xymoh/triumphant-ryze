const { UserError } = require('./errors.js');

const FORMAT_HINT = 'Use the format **Name#TAG**, for example `Faker#KR1`.';

/**
 * Parses "Name#TAG" into its parts. Riot game names can contain spaces and non-latin characters,
 * so we only split on the last "#" and trim around it.
 */
const parseRiotId = (input) => {
  const value = String(input ?? '').trim();
  const hashIndex = value.lastIndexOf('#');
  if (hashIndex === -1) {
    throw new UserError(`\`${value || ' '}\` is missing a tag. ${FORMAT_HINT}`);
  }

  const gameName = value.slice(0, hashIndex).trim();
  const tagLine = value.slice(hashIndex + 1).trim();

  if (gameName.length < 1 || gameName.length > 16 || tagLine.length < 1 || tagLine.length > 5) {
    throw new UserError(`\`${value}\` doesn't look like a valid Riot ID. ${FORMAT_HINT}`);
  }

  return { gameName, tagLine };
};

const formatRiotId = (gameName, tagLine) => (tagLine ? `${gameName}#${tagLine}` : gameName);

const sameRiotId = (a, b) =>
  a.gameName.toLowerCase() === b.gameName.toLowerCase() &&
  String(a.tagLine).toLowerCase() === String(b.tagLine).toLowerCase();

module.exports = { parseRiotId, formatRiotId, sameRiotId };
