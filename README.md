# Triumphant Ryze

A Discord bot that tracks League of Legends ranks for a group of friends and settles who is
really the best. Add everyone once, then `/ranking` shows a live leaderboard.

## Features

- **Leaderboard**: `/ranking` for Ranked Solo/Duo or Flex, with medals, win rates and hot
  streaks, plus buttons to switch queue, page through big groups and refresh.
- **Group highlights**: best win rate, most games played, and who is on a win streak right now.
- **Player profiles**: `/profile` shows both ranked queues, level, top-3 champion mastery and links
  to OP.GG / U.GG / League of Graphs for any Riot ID. There is a one-click **Add to leaderboard**
  button.
- **Automatic region detection**: players from different servers (EUW + EUNE, NA + OCE, ...) can
  share one leaderboard.
- **Discord links**: you can link a player to a Discord member, and they show up as a mention on
  the leaderboard.
- **Ranked crest emojis**: real tier emblems shown inline (optional, one command to set up).
- **Built for public use**: Riot API rate limiting with retries, caching, per-server player cap,
  admin-only destructive actions, and data is cleaned up automatically when the bot is removed.

## Commands

| Command                                    | Who           | What it does                                                      |
| ------------------------------------------ | ------------- | ----------------------------------------------------------------- |
| `/ranking [queue]`                         | everyone      | Server leaderboard (Solo/Duo by default)                          |
| `/profile <player> [region]`               | everyone      | Ranks, level and top champions of a tracked player or any Riot ID |
| `/player add <Name#TAG> [region] [member]` | everyone      | Add a player; region is detected automatically                    |
| `/player remove <player>`                  | everyone      | Remove a player (autocompletes tracked players)                   |
| `/player list`                             | everyone      | Everyone on the leaderboard                                       |
| `/player clear`                            | Manage Server | Remove everyone (asks for confirmation)                           |
| `/settings [region]`                       | Manage Server | Show or change the server's default region                        |
| `/help`                                    | everyone      | Usage, invite link and the Riot legal notice                      |

Server admins can restrict any command further in **Server Settings → Integrations**.

## Setup

Requirements: **Node.js 20.17+** and a Riot API key (see [docs/RIOT_API_KEY.md](docs/RIOT_API_KEY.md)).

1. **Create the Discord application** at <https://discord.com/developers/applications>.
   - Copy the **Application ID**. Then, under **Bot**, reset and copy the **token**.
   - No privileged intents are needed.
   - Under **Installation**, enable _Guild Install_ with the scopes `bot` and
     `applications.commands`. Select the permissions _View Channels_, _Send Messages_,
     _Embed Links_ and _Use External Emojis_.
2. **Configure**
   ```bash
   cp .env.example .env   # then fill in DISCORD_TOKEN, CLIENT_ID and RIOT_API_KEY
   npm install
   ```
3. **Register the slash commands** (run again whenever command definitions change)
   ```bash
   npm run deploy               # global, can take a few minutes to appear
   npm run deploy -- --guild    # only DEV_GUILD_ID, appears instantly (for testing)
   ```
4. **Optional: upload the ranked crest emojis**. They become application emojis owned by the bot,
   so they work in every server.
   ```bash
   npm run emojis
   ```
5. **Start the bot**
   ```bash
   npm start
   ```

### Database

- With `DATABASE_URL` empty, the bot uses a local SQLite file at `data/bot.sqlite`. This needs no
  setup and is fine for development and small installs.
- For production, set `DATABASE_URL` to a Postgres connection string. For hosted databases, also
  set `DATABASE_SSL=true`, or `no-verify` for providers with self-signed certificates.
- Tables are created and upgraded automatically on startup.

### Docker

```bash
# .env must also contain POSTGRES_PASSWORD
docker compose up -d
docker compose run --rm bot node deploy-commands.js
```

## Upgrading from 1.x

- **Database:** keep your existing database. Point `DATABASE_URL` at it, for example
  `postgres://postgres:<password>@localhost:5433/triumphantRyzeDB`. On first start the bot:
  - adds the new columns;
  - removes duplicate players (the old duplicate check was case-sensitive);
  - moves players from the retired PH2/TH2 servers to SG2.
- **Environment:** `API_KEY` still works, but rename it to `RIOT_API_KEY`.
- **Commands:** they changed, so run `npm run deploy` once. The old ones are replaced:

| Old                     | New                 |
| ----------------------- | ------------------- |
| `/add-summoner`         | `/player add`       |
| `/delete-summoner`      | `/player remove`    |
| `/show-all-summoners`   | `/player list`      |
| `/delete-all-summoners` | `/player clear`     |
| `/change-region`        | `/settings region:` |
| `/show-region`          | `/settings`         |

## Development

```bash
npm test        # unit + end-to-end command tests (fake Riot API, in-memory SQLite)
npm run lint
npm run format
```

Project layout:

```
commands/   one file per slash command (+ its buttons/autocomplete)
events/     Discord gateway events (ready, guild join/leave, interaction router)
utils/      riot.js (API client), leaderboard.js, ranks.js, regions.js, db.js, ...
scripts/    one-off tools (emoji upload)
assets/     ranked crest images used for the emojis
test/       node:test suites
```

## Data the bot stores

For every server:

- the server ID and its default region;
- each tracked player's Riot ID, PUUID and region;
- if linked, the Discord user ID of the linked member and of whoever added the player.

When the bot is removed from a server, that server's data is deleted. Ranks are fetched live from
Riot and only cached in memory for about 2 minutes. Use this list as the basis for your privacy
policy.

## Legal

Triumphant Ryze isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games
or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all
associated properties are trademarks or registered trademarks of Riot Games, Inc.
