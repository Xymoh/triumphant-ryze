/** An error whose message is safe and meant to be shown to the Discord user as-is. */
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

class RiotApiError extends Error {
  constructor(status, path, retryAfterMs, options) {
    super(`Riot API responded with ${status} for ${path}`, options);
    this.name = 'RiotApiError';
    this.status = status;
    this.path = path;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Turns any error into a friendly, non-technical message for the user. */
const toUserMessage = (error) => {
  if (error instanceof UserError) return error.message;
  if (error instanceof RiotApiError) {
    if (error.status === 401 || error.status === 403) {
      return "The bot's Riot API key is missing, invalid or expired. Please let the bot owner know.";
    }
    if (error.status === 404) return 'Riot could not find that player.';
    if (error.status === 429) {
      return 'The Riot API is busy right now. Please try again in a minute.';
    }
    if (error.status >= 500 || error.status === 0) {
      return 'Riot servers are having trouble at the moment. Please try again later.';
    }
  }
  return 'Something went wrong while running that command. Please try again.';
};

module.exports = { UserError, RiotApiError, toUserMessage };
