# Getting your own Riot API key

The bot must use a key that Riot issued **to you, for this product**. Riot's API Terms don't allow
using, borrowing or sharing another developer's key. You may only share a key with teammates
through a group in the developer portal, and each key is for one product. If the bot currently
runs on a key from another bot, replace it before sharing the bot publicly.

Sources: [API Terms](https://developer.riotgames.com/terms),
[General Policies](https://developer.riotgames.com/policies/general)

## Which key do you need?

| Key         | Lifetime           | Rate limit (per region)                   | Allowed use                                                                    |
| ----------- | ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Development | expires every 24 h | 20 req/s, 100 req/2 min                   | Building and testing only                                                      |
| Personal    | doesn't expire     | 20 req/s, 100 req/2 min                   | You and a small private community, e.g. your friends' Discord. **Not public.** |
| Production  | doesn't expire     | starts at 500 req/10 s, 30,000 req/10 min | Public products, e.g. a bot anyone can invite                                  |

You don't need to configure the limits. The bot reads them from Riot's `X-App-Rate-Limit` headers
and adapts on its own.

## Recommended plan

1. **Now: apply for a Personal key.** It covers running the bot for your own group while you
   prepare to go public. No website or domain verification is needed. Riot does want a detailed
   description; reuse the one below.
2. **In parallel, build the public pieces the Production review asks for** (see the checklist).
3. **Then apply for a Production key**, before you list the bot anywhere public.
   - Officially Riot reviews applications weekly and it can take up to 3 weeks.
   - In 2025–2026 developers reported waits from **2 to 12+ months**, so apply early.

## How to apply

1. Log in at <https://developer.riotgames.com> and click **Register Product**.
2. Choose **Personal** or **Production** and accept the policies.
3. Fill in the form: name, detailed description, product URL, game focus (League of Legends), and
   "no" for tournaments.
4. **Production only:** verify your website's domain by uploading the text Riot gives you as
   `riot.txt` at the site root. Riot accepts no other proof of ownership.
5. Answers arrive as messages in the developer portal. Questions go to
   <https://support-developer.riotgames.com>.

## Production checklist

- [ ] **Working product.** This bot qualifies. Screenshots or a short video of `/ranking` and
      `/profile` help reviewers.
- [ ] **Website** that describes the bot and links to the invite. Riot doesn't accept a GitHub repo
      or source code as a substitute; Discord bots need a site too.
- [ ] **Terms of Service** and **Privacy Policy** pages on that website. The "Data the bot stores"
      section in the README lists what to disclose.
- [ ] **Domain verified** with `riot.txt`.
- [ ] **Legal notice** ("isn't endorsed by Riot Games...") visible to players. It's already in
      `/help` and the README; put it in your website footer too.
- [ ] **Name and domain check.**
  - Riot's fan-content policy forbids registering **domains or social media accounts** that use
    Riot trademarks or **champion names**. A domain like `triumphant-ryze.gg` would break that rule.
  - Riot has no explicit rule about the bot's own name. Still, a neutral brand for the
    website and domain (and possibly the bot) is the safer choice.
- [ ] **Use-case compliance.**
  - Leaderboards of official ranked positions are an approved use case.
  - MMR/ELO estimates or alternatives to the official ladder are prohibited; the bot doesn't
    compute any.
- [ ] **Monetization** (only if you ever add it):
  - there must be a free tier (ads are OK);
  - subscriptions and donations are fine;
  - no gambling or crypto.

Sources: [Portal docs](https://developer.riotgames.com/docs/portal),
[FAQ](https://developer.riotgames.com/docs/faqs),
[LoL policy](https://developer.riotgames.com/docs/lol#game-policy),
[Legal Jibber Jabber](https://www.riotgames.com/en/legal)

## Draft product description

Adjust it to your final name and URL:

> **Triumphant Ryze** is a free Discord bot that lets groups of friends compare their League of
> Legends ranked standings inside their own Discord server.
>
> **How it works:**
>
> - Server members add players by Riot ID (`/player add Name#TAG`). The bot resolves the account
>   with ACCOUNT-V1 (`accounts/by-riot-id`) and detects the player's League server with
>   `region/by-game/lol/by-puuid`.
> - `/ranking` shows a per-server leaderboard of **official** ranked positions (tier, division,
>   LP, wins/losses) for Ranked Solo/Duo and Ranked Flex, from LEAGUE-V4 `entries/by-puuid`.
> - `/profile` shows one player's ranks, level and profile icon (SUMMONER-V4 `by-puuid`) and
>   their top 3 champion masteries (CHAMPION-MASTERY-V4 `by-puuid/top`), with links to OP.GG and
>   U.GG.
>
> **API usage:**
>
> - Rank data is cached for 2 minutes. Requests are rate-limited on our side from the
>   X-App-Rate-Limit headers, and 429 Retry-After is honored.
> - Each server can track at most 50 players.
> - We don't estimate MMR, don't sell or share data, and don't show match or custom-game history.
>
> **Data we store:** Riot ID, PUUID and platform of each tracked player, per Discord server. It is
> deleted automatically when the bot is removed from a server.
>
> **Links:** website, Terms and Privacy Policy at `https://<your-domain>`.
>
> The bot shows Riot's required legal notice in its `/help` command and on the website.

## Estimating your API usage

Each `/ranking` costs at most one LEAGUE-V4 call per player not already in the 2-minute cache.
Tab, page and refresh buttons within that window cost nothing.

Adding a player costs about 4 calls:

- account;
- region;
- summoner;
- league entries.

`/profile` costs about 3 calls.

At personal-key limits (100 requests per 2 minutes per region), a few active servers are
comfortable. The limit becomes the bottleneck once the bot is public, which is why you need
Production.
