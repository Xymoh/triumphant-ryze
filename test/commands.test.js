/**
 * End-to-end tests: every command runs through the real interaction router against an in-memory
 * SQLite database and a fake Riot API (global fetch is stubbed). Replies are checked against
 * Discord's message limits so a bad embed can't slip through to production.
 */
process.env.DATABASE_URL = '';
process.env.SQLITE_PATH = ':memory:';
process.env.RIOT_API_KEY = 'test-key';
process.env.MAX_PLAYERS_PER_GUILD = '15';

const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const { Collection, PermissionFlagsBits, PermissionsBitField } = require('discord.js');

const db = require('../utils/db.js');
const riot = require('../utils/riot.js');
const interactionCreate = require('../events/interactionCreate.js');
const guildCreate = require('../events/guildCreate.js');
const guildDelete = require('../events/guildDelete.js');
const ready = require('../events/ready.js');
const { loadCommands } = require('../utils/loadModules.js');

// ---- Fake Riot API -----------------------------------------------------------------------------

const puuidFor = (name) => `${name}-`.padEnd(78, 'x'); // real PUUIDs are 78 characters
const entry = (queueType, tier, rank, leaguePoints, wins, losses, extra = {}) => ({
  queueType,
  tier,
  rank,
  leaguePoints,
  wins,
  losses,
  hotStreak: false,
  ...extra,
});

const world = {
  accounts: new Map(),
  overrides: new Map(), // url substring -> { status, headers, times }
  requests: [],
};

const addAccount = (gameName, tagLine, platform, entries = [], extra = {}) => {
  const puuid = puuidFor(gameName);
  world.accounts.set(puuid, { puuid, gameName, tagLine, platform, entries, ...extra });
  return puuid;
};

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-app-rate-limit': '20:1,100:120', ...headers },
  });

const notFound = () => json(404, { status: { message: 'Data not found', status_code: 404 } });

globalThis.fetch = async (input, init) => {
  const url = decodeURIComponent(String(input));
  world.requests.push({ url, token: init?.headers?.['X-Riot-Token'] });

  for (const [fragment, override] of world.overrides) {
    if (url.includes(fragment) && override.times !== 0) {
      override.times -= 1;
      return json(override.status, { status: { status_code: override.status } }, override.headers);
    }
  }

  if (url.startsWith('https://ddragon.leagueoflegends.com/api/versions.json')) {
    return json(200, ['16.18.1', '16.17.1']);
  }
  if (url.includes('/data/en_US/champion.json')) {
    return json(200, {
      data: { Ryze: { key: '13', name: 'Ryze' }, Ahri: { key: '103', name: 'Ahri' } },
    });
  }

  const [, host, path] = /^https:\/\/([a-z0-9]+)\.api\.riotgames\.com(\/.*)$/.exec(url) ?? [];
  if (!host) return notFound();
  const accounts = [...world.accounts.values()];
  let match;

  if ((match = /^\/riot\/account\/v1\/accounts\/by-riot-id\/(.+)\/(.+)$/.exec(path))) {
    const account = accounts.find(
      (a) =>
        a.gameName.toLowerCase() === match[1].toLowerCase() &&
        a.tagLine.toLowerCase() === match[2].toLowerCase()
    );
    return account
      ? json(200, { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine })
      : notFound();
  }
  if ((match = /^\/riot\/account\/v1\/accounts\/by-puuid\/(.+)$/.exec(path))) {
    const account = world.accounts.get(match[1]);
    return account
      ? json(200, { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine })
      : notFound();
  }
  if ((match = /^\/riot\/account\/v1\/region\/by-game\/lol\/by-puuid\/(.+)$/.exec(path))) {
    const account = world.accounts.get(match[1]);
    return account
      ? json(200, { puuid: account.puuid, game: 'lol', region: account.platform })
      : notFound();
  }

  // Platform endpoints only know players who play on that platform.
  const onPlatform = (puuid) => {
    const account = world.accounts.get(puuid);
    return account && account.platform === host ? account : null;
  };
  if ((match = /^\/lol\/summoner\/v4\/summoners\/by-puuid\/(.+)$/.exec(path))) {
    const account = onPlatform(match[1]);
    return account
      ? json(200, { puuid: account.puuid, profileIconId: 29, summonerLevel: 321, revisionDate: 1 })
      : notFound();
  }
  if ((match = /^\/lol\/league\/v4\/entries\/by-puuid\/(.+)$/.exec(path))) {
    const account = onPlatform(match[1]);
    return json(200, account ? account.entries.map((e) => ({ ...e, puuid: account.puuid })) : []);
  }
  if (
    (match = /^\/lol\/champion-mastery\/v4\/champion-masteries\/by-puuid\/(.+)\/top\?count=3$/.exec(
      path
    ))
  ) {
    return onPlatform(match[1])
      ? json(200, [
          { championId: 13, championLevel: 42, championPoints: 1_234_567 },
          { championId: 103, championLevel: 12, championPoints: 150_000 },
        ])
      : json(200, []);
  }
  return notFound();
};

// ---- Fake Discord interactions -----------------------------------------------------------------

const commands = new Collection(loadCommands().map((command) => [command.data.name, command]));
const guild = {
  id: 'guild-1',
  name: 'The Rift Friends',
  preferredLocale: 'pl',
  iconURL: () => null,
};
const alice = { id: '111', username: 'alice', bot: false };
const ADMIN = PermissionFlagsBits.ManageGuild | PermissionFlagsBits.SendMessages;

const makeInteraction = ({
  type = 'command',
  commandName,
  subcommand = null,
  options = {},
  customId,
  permissions = PermissionFlagsBits.SendMessages,
}) => {
  const calls = [];
  const record = (name) =>
    async function recorder(payload) {
      calls.push({ name, payload });
      if (['deferReply', 'deferUpdate'].includes(name)) this.deferred = true;
      if (['reply', 'editReply', 'update'].includes(name)) this.replied = true;
      if (name === 'respond') this.responded = true;
    };
  return {
    calls,
    commandName,
    customId,
    guild,
    guildId: guild.id,
    guildLocale: 'pl',
    user: alice,
    applicationId: 'app-1',
    memberPermissions: new PermissionsBitField(permissions),
    client: {
      commands,
      generateInvite: () => 'https://discord.com/oauth2/authorize?client_id=app-1',
    },
    deferred: false,
    replied: false,
    responded: false,
    options: {
      getString: (name) => options[name] ?? null,
      getUser: (name) => options[name] ?? null,
      getSubcommand: () => subcommand,
      getFocused: () => options.focused ?? '',
    },
    isAutocomplete: () => type === 'autocomplete',
    isChatInputCommand: () => type === 'command',
    isMessageComponent: () => type === 'component',
    deferReply: record('deferReply'),
    deferUpdate: record('deferUpdate'),
    reply: record('reply'),
    editReply: record('editReply'),
    followUp: record('followUp'),
    update: record('update'),
    respond: record('respond'),
  };
};

const run = async (spec) => {
  const interaction = makeInteraction(spec);
  await interactionCreate.execute(interaction);
  return interaction;
};

/** The last message-producing call, with embeds/components converted to raw JSON. */
const lastMessage = (interaction) => {
  const call = interaction.calls.filter((c) => c.payload && c.name !== 'respond').at(-1);
  assert.ok(call, `no reply was sent (calls: ${interaction.calls.map((c) => c.name)})`);
  const toJSON = (value) => (value?.toJSON ? value.toJSON() : value);
  const embeds = (call.payload.embeds ?? []).map(toJSON);
  const components = (call.payload.components ?? []).map(toJSON);
  assertWithinDiscordLimits(embeds, components);
  const text = embeds
    .map((e) =>
      [
        e.title,
        e.description,
        e.author?.name,
        e.footer?.text,
        ...(e.fields ?? []).flatMap((f) => [f.name, f.value]),
      ].join('\n')
    )
    .join('\n');
  return { ...call, embeds, components, text };
};

const assertWithinDiscordLimits = (embeds, components) => {
  assert.ok(embeds.length <= 10);
  for (const embed of embeds) {
    const fields = embed.fields ?? [];
    assert.ok(fields.length <= 25, 'too many fields');
    assert.ok((embed.title ?? '').length <= 256);
    assert.ok((embed.description ?? '').length <= 4096, 'description too long');
    assert.ok((embed.footer?.text ?? '').length <= 2048);
    assert.ok((embed.author?.name ?? '').length <= 256);
    for (const field of fields) {
      assert.ok(field.name.length > 0 && field.name.length <= 256, `bad field name ${field.name}`);
      assert.ok(field.value.length > 0 && field.value.length <= 1024, `bad field ${field.name}`);
    }
    const total = [embed.title, embed.description, embed.footer?.text, embed.author?.name]
      .concat(fields.flatMap((f) => [f.name, f.value]))
      .reduce((sum, part) => sum + (part?.length ?? 0), 0);
    assert.ok(total <= 6000, `embed is ${total} characters`);
  }

  assert.ok(components.length <= 5, 'too many action rows');
  const ids = new Set();
  for (const row of components) {
    assert.ok(row.components.length >= 1 && row.components.length <= 5, 'bad action row size');
    for (const component of row.components) {
      if (component.url) {
        assert.equal(component.custom_id, undefined);
        continue;
      }
      assert.ok(component.custom_id.length <= 100, `custom_id too long: ${component.custom_id}`);
      assert.ok(!ids.has(component.custom_id), `duplicate custom_id ${component.custom_id}`);
      ids.add(component.custom_id);
    }
  }
};

const addPlayerCommand = (riotId, extra = {}) =>
  run({ commandName: 'player', subcommand: 'add', options: { 'riot-id': riotId, ...extra } });

// ---- Tests -------------------------------------------------------------------------------------

before(async () => {
  await db.initDatabase();
});

after(async () => {
  await db.closeDatabase();
});

beforeEach(async () => {
  riot._cache.clear();
  world.overrides.clear();
  world.requests.length = 0;
  await db.Player.destroy({ where: {} });
  await db.GuildConfig.destroy({ where: {} });
});

describe('slash command definitions', () => {
  test('all commands serialize and respect Discord limits', () => {
    const names = new Set();
    for (const command of commands.values()) {
      const json = command.data.toJSON();
      assert.ok(!names.has(json.name), `duplicate command ${json.name}`);
      names.add(json.name);
      assert.ok(json.description.length <= 100);
      const walk = (options = []) => {
        assert.ok(options.length <= 25);
        for (const option of options) {
          assert.ok(option.description.length <= 100, `${option.name} description too long`);
          assert.ok((option.choices ?? []).length <= 25);
          walk(option.options);
        }
      };
      walk(json.options);
    }
    assert.deepEqual([...names].sort(), ['help', 'player', 'profile', 'ranking', 'settings']);
  });
});

describe('/player add', () => {
  test('detects the region automatically and shows both queues', async () => {
    addAccount('Faker', 'KR1', 'kr', [
      entry('RANKED_SOLO_5x5', 'CHALLENGER', 'I', 1523, 300, 200, { hotStreak: true }),
    ]);
    const interaction = await addPlayerCommand('faker#kr1');
    const message = lastMessage(interaction);

    assert.equal(message.name, 'editReply');
    assert.match(message.text, /Faker#KR1 joined the leaderboard/);
    assert.match(message.text, /\*\*Challenger\*\* · 1523 LP/);
    assert.match(message.text, /300W 200L · 60% WR 🔥/);
    assert.match(message.text, /Korea/);

    const [player] = await db.listPlayers(guild.id);
    assert.equal(player.platform, 'KR');
    assert.equal(player.gameName, 'Faker'); // canonical casing from Riot, not what was typed
    assert.equal(player.addedBy, alice.id);
    assert.ok(
      world.requests.every((r) => !r.url.includes('riotgames.com') || r.token === 'test-key')
    );
  });

  test('links a Discord member and refuses duplicates', async () => {
    addAccount('Caps', 'EUW', 'euw1');
    const member = { id: '222', username: 'caps', bot: false };
    const first = lastMessage(await addPlayerCommand('Caps#EUW', { member }));
    assert.match(first.text, /Linked to <@222>/);

    const second = lastMessage(await addPlayerCommand('CAPS#euw'));
    assert.match(second.text, /already on this server's leaderboard/);
    assert.equal(await db.countPlayers(guild.id), 1);
  });

  test('explains typos privately without calling Riot', async () => {
    const message = lastMessage(await addPlayerCommand('JustAName'));
    assert.equal(message.name, 'reply');
    assert.ok(message.payload.flags, 'should be ephemeral');
    assert.match(message.text, /missing a tag/);
    assert.equal(world.requests.length, 0);
  });

  test('reports unknown Riot IDs', async () => {
    const message = lastMessage(await addPlayerCommand('Nobody#0000'));
    assert.match(message.text, /Couldn't find \*\*Nobody#0000\*\*/);
  });

  test('explains when the player has no profile in the chosen region', async () => {
    addAccount('Caps', 'EUW', 'euw1');
    const message = lastMessage(await addPlayerCommand('Caps#EUW', { region: 'NA1' }));
    assert.match(message.text, /no League of Legends profile on \*\*North America\*\*/);
  });

  test("falls back to the server's region when Riot's region lookup fails", async () => {
    addAccount('Zbyszek', 'PL1', 'eun1');
    world.overrides.set('/region/by-game/', { status: 500, times: 1 });
    const message = lastMessage(await addPlayerCommand('Zbyszek#PL1'));
    // Guild locale is Polish, so the default region is EUNE.
    assert.match(message.text, /Europe Nordic & East/);
    assert.equal(
      world.requests.filter((r) => r.url.includes('/region/by-game/')).length,
      1,
      'the buggy region endpoint should not be retried'
    );
  });

  test('enforces the per-server player limit', async () => {
    for (let i = 0; i < 15; i += 1) {
      await db.addPlayer({
        guildId: guild.id,
        puuid: `p${i}`,
        platform: 'EUW1',
        gameName: `P${i}`,
        tagLine: 'EUW',
      });
    }
    addAccount('Caps', 'EUW', 'euw1');
    const message = lastMessage(await addPlayerCommand('Caps#EUW'));
    assert.match(message.text, /maximum of \*\*15\*\* players/);
  });
});

describe('/ranking', () => {
  const seed = async () => {
    const players = [
      ['Faker', 'KR1', 'kr', [entry('RANKED_SOLO_5x5', 'CHALLENGER', 'I', 1523, 300, 200)]],
      [
        'Caps',
        'EUW',
        'euw1',
        [
          entry('RANKED_SOLO_5x5', 'EMERALD', 'II', 45, 50, 40, { hotStreak: true }),
          entry('RANKED_FLEX_SR', 'DIAMOND', 'IV', 10, 12, 8),
        ],
      ],
      ['Gold Guy', 'EUNE', 'eun1', [entry('RANKED_SOLO_5x5', 'GOLD', 'I', 99, 100, 101)]],
      ['Newbie', 'EUNE', 'eun1', []],
    ];
    for (const [gameName, tagLine, platform, entries] of players) {
      const puuid = addAccount(gameName, tagLine, platform, entries);
      await db.addPlayer({
        guildId: guild.id,
        puuid,
        platform: platform.toUpperCase(),
        gameName,
        tagLine,
        riotIdCheckedAt: new Date(),
      });
    }
  };

  test('shows an empty state before anyone is added', async () => {
    const message = lastMessage(await run({ commandName: 'ranking' }));
    assert.match(message.text, /Nobody is on the leaderboard yet/);
  });

  test('sorts correctly (Emerald above Gold), shows medals, highlights and tabs', async () => {
    await seed();
    const message = lastMessage(await run({ commandName: 'ranking' }));
    const lines = message.embeds[0].description.split('\n\n');

    assert.match(
      lines[0],
      /^🥇 \*\*\[Faker#KR1\]\(https:\/\/op\.gg\/lol\/summoners\/kr\/Faker-KR1\)\*\*/
    );
    assert.match(lines[1], /^🥈 .*Caps#EUW/);
    assert.match(lines[2], /^🥉 .*Gold Guy#EUNE/);
    assert.match(lines[3], /^`#4` .*Newbie#EUNE[\s\S]*Unranked/);
    assert.match(lines[0], /`KR`/, 'mixed regions should show a region tag');
    assert.match(message.text, /Best win rate/);
    assert.match(message.text, /On a win streak/);
    assert.match(message.embeds[0].author.name, /The Rift Friends · Ranked Solo\/Duo/);

    const buttons = message.components[0].components;
    assert.deepEqual(
      buttons.map((b) => b.label ?? b.emoji?.name),
      ['Solo/Duo', 'Flex', '🔄']
    );
    assert.equal(buttons[0].disabled, true);
  });

  test('switches to Flex with the tab button and edits the same message', async () => {
    await seed();
    const interaction = await run({ type: 'component', customId: 'ranking:flex:0:tab' });
    assert.equal(interaction.calls[0].name, 'deferUpdate');
    const message = lastMessage(interaction);
    assert.equal(message.name, 'editReply');
    assert.match(message.embeds[0].author.name, /Ranked Flex/);
    assert.match(message.embeds[0].description.split('\n\n')[0], /Caps#EUW[\s\S]*Diamond IV/);
  });

  test('paginates big groups', async () => {
    for (let i = 0; i < 13; i += 1) {
      const name = `Player${String(i).padStart(2, '0')}`;
      const puuid = addAccount(name, 'EUW', 'euw1', [
        entry('RANKED_SOLO_5x5', 'SILVER', 'II', i, 10, 10),
      ]);
      await db.addPlayer({
        guildId: guild.id,
        puuid,
        platform: 'EUW1',
        gameName: name,
        tagLine: 'EUW',
        riotIdCheckedAt: new Date(),
      });
    }
    const first = lastMessage(await run({ commandName: 'ranking' }));
    assert.match(first.embeds[0].footer.text, /Page 1\/2/);
    assert.equal(first.components[0].components.length, 5);

    const second = lastMessage(await run({ type: 'component', customId: 'ranking:solo:1:next' }));
    assert.match(second.embeds[0].footer.text, /Page 2\/2/);
    assert.match(second.embeds[0].description, /^`#11`/);
    assert.equal(second.embeds[0].fields, undefined, 'highlights only on the first page');
  });

  test('one failing player does not break the leaderboard', async () => {
    await seed();
    world.overrides.set(`/entries/by-puuid/${puuidFor('Caps')}`, { status: 503, times: 5 });
    const message = lastMessage(await run({ commandName: 'ranking' }));
    assert.match(message.text, /Faker#KR1/);
    assert.match(message.text, /Caps#EUW[\s\S]*Could not load this rank/);
  });

  test('an expired API key produces a clear message', async () => {
    await seed();
    world.overrides.set('/entries/by-puuid/', { status: 403, times: 100 });
    const originalError = console.error;
    console.error = () => {};
    try {
      const message = lastMessage(await run({ commandName: 'ranking' }));
      assert.match(message.text, /Riot API key is missing, invalid or expired/);
    } finally {
      console.error = originalError;
    }
  });

  test('retries after a 429 using Retry-After', async () => {
    await seed();
    world.overrides.set(`/entries/by-puuid/${puuidFor('Faker')}`, {
      status: 429,
      times: 1,
      headers: { 'retry-after': '1', 'x-rate-limit-type': 'method' },
    });
    const message = lastMessage(await run({ commandName: 'ranking' }));
    assert.match(message.text, /Faker#KR1[\s\S]*Challenger/);
  });

  test('tabs use the cache; Refresh re-fetches but only once per cooldown', async () => {
    await seed();
    const leagueCalls = () => world.requests.filter((r) => r.url.includes('/entries/')).length;
    await run({ commandName: 'ranking' });
    const initial = leagueCalls();
    assert.equal(initial, 4);

    await run({ type: 'component', customId: 'ranking:flex:0:tab' });
    assert.equal(leagueCalls(), initial, 'switching tabs must not hit the Riot API');

    await run({ type: 'component', customId: 'ranking:solo:0:refresh' });
    assert.equal(leagueCalls(), initial + 4, 'refresh fetches fresh ranks');

    await run({ type: 'component', customId: 'ranking:solo:0:refresh' });
    assert.equal(leagueCalls(), initial + 4, 'refresh spam is throttled');
  });

  test('outdated buttons get a clear message instead of failing silently', async () => {
    const message = lastMessage(await run({ type: 'component', customId: 'ranking:arena:0:tab' }));
    assert.equal(message.name, 'reply');
    assert.ok(message.payload.flags, 'should be ephemeral');
    assert.match(message.text, /outdated/);
  });

  test('refreshes renamed Riot IDs in the background', async () => {
    const puuid = addAccount('NewName', 'EUW', 'euw1');
    await db.addPlayer({
      guildId: guild.id,
      puuid,
      platform: 'EUW1',
      gameName: 'OldName',
      tagLine: 'EUW',
    });
    await run({ commandName: 'ranking' });
    // The refresh runs in the background; poll instead of guessing how long it takes.
    let player;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      [player] = await db.listPlayers(guild.id);
      if (player.gameName === 'NewName') break;
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(player.gameName, 'NewName');
    assert.ok(player.riotIdCheckedAt);
  });
});

describe('/player remove, list, clear', () => {
  const seedTwo = async () => {
    await db.addPlayer({
      guildId: guild.id,
      puuid: 'a',
      platform: 'EUW1',
      gameName: 'Alpha',
      tagLine: 'EUW',
    });
    await db.addPlayer({
      guildId: guild.id,
      puuid: 'b',
      platform: 'KR',
      gameName: 'Beta',
      tagLine: 'KR1',
      discordUserId: '333',
    });
  };

  test('autocomplete suggests tracked players and remove accepts the choice', async () => {
    await seedTwo();
    const auto = await run({
      type: 'autocomplete',
      commandName: 'player',
      options: { focused: 'be' },
    });
    const choices = auto.calls.find((c) => c.name === 'respond').payload;
    assert.deepEqual(
      choices.map((c) => c.name),
      ['Beta#KR1 (KR)']
    );

    const removed = lastMessage(
      await run({
        commandName: 'player',
        subcommand: 'remove',
        options: { player: choices[0].value },
      })
    );
    assert.match(removed.text, /Removed \*\*Beta#KR1\*\*/);
    assert.equal(await db.countPlayers(guild.id), 1);
  });

  test('remove also accepts a typed Riot ID', async () => {
    await seedTwo();
    const message = lastMessage(
      await run({ commandName: 'player', subcommand: 'remove', options: { player: 'alpha#euw' } })
    );
    assert.match(message.text, /Removed \*\*Alpha#EUW\*\*/);
  });

  test('list shows regions and linked members', async () => {
    await seedTwo();
    const message = lastMessage(await run({ commandName: 'player', subcommand: 'list' }));
    assert.match(message.embeds[0].title, /Tracked players \(2\/15\)/);
    assert.match(message.text, /\*\*Beta#KR1\*\* · `KR` · <@333>/);
    assert.match(message.text, /Default region: Europe Nordic & East/);
  });

  test('clear needs Manage Server and a confirmation click', async () => {
    await seedTwo();
    const denied = lastMessage(await run({ commandName: 'player', subcommand: 'clear' }));
    assert.match(denied.text, /Manage Server/);

    const prompt = lastMessage(
      await run({ commandName: 'player', subcommand: 'clear', permissions: ADMIN })
    );
    assert.match(prompt.text, /all 2 players/);
    assert.equal(await db.countPlayers(guild.id), 2, 'nothing removed before confirming');

    const cancel = lastMessage(await run({ type: 'component', customId: 'player:clear-cancel' }));
    assert.match(cancel.text, /Cancelled/);

    const confirmed = lastMessage(
      await run({ type: 'component', customId: 'player:clear-confirm', permissions: ADMIN })
    );
    assert.equal(confirmed.name, 'update');
    assert.match(confirmed.text, /Removed \*\*2\*\* players/);
    assert.equal(await db.countPlayers(guild.id), 0);
  });
});

describe('/profile', () => {
  test('shows any Riot ID with masteries, links and an add button that works', async () => {
    addAccount('Faker', 'KR1', 'kr', [entry('RANKED_SOLO_5x5', 'GRANDMASTER', 'I', 800, 90, 60)]);
    const message = lastMessage(
      await run({ commandName: 'profile', options: { player: 'Faker#KR1' } })
    );

    assert.equal(message.embeds[0].author.name, 'Faker#KR1');
    assert.match(message.embeds[0].author.icon_url, /16\.18\.1\/img\/profileicon\/29\.png$/);
    assert.match(message.text, /Level \*\*321\*\* · Korea/);
    assert.match(message.text, /\*\*Grandmaster\*\* · 800 LP/);
    assert.match(message.text, /\*\*Ryze\*\* · Mastery 42 · 1\.2M pts/);

    const buttons = message.components[0].components;
    assert.deepEqual(
      buttons.map((b) => b.label),
      ['OP.GG', 'U.GG', 'League of Graphs', 'Add to leaderboard']
    );
    assert.equal(buttons[1].url, 'https://u.gg/lol/profile/kr/Faker-KR1/overview');

    const added = lastMessage(await run({ type: 'component', customId: buttons[3].custom_id }));
    assert.match(added.text, /Faker#KR1 joined the leaderboard/);
    assert.equal(await db.countPlayers(guild.id), 1);
  });

  test('tracked players come from autocomplete and have no add button', async () => {
    const puuid = addAccount('Caps', 'EUW', 'euw1');
    const player = await db.addPlayer({
      guildId: guild.id,
      puuid,
      platform: 'EUW1',
      gameName: 'Caps',
      tagLine: 'EUW',
      discordUserId: '444',
    });
    const message = lastMessage(
      await run({ commandName: 'profile', options: { player: `id:${player.id}` } })
    );
    assert.match(message.text, /On this server's leaderboard/);
    assert.match(message.text, /<@444>/);
    assert.match(message.text, /Unranked/);
    assert.ok(!message.components[0].components.some((b) => b.custom_id));
  });
});

describe('/settings and /help', () => {
  test('changing the region is announced, viewing is private', async () => {
    const changed = lastMessage(
      await run({ commandName: 'settings', options: { region: 'EUW1' }, permissions: ADMIN })
    );
    assert.match(changed.text, /Default region changed to \*\*Europe West\*\*/);
    assert.equal(changed.payload.flags, undefined);
    assert.equal((await db.getGuildConfig(guild.id, 'NA1')).region, 'EUW1');

    const viewed = lastMessage(await run({ commandName: 'settings', permissions: ADMIN }));
    assert.ok(viewed.payload.flags);
    assert.match(viewed.text, /Europe West \(`EUW`\)/);
  });

  test('help lists commands and includes the Riot legal notice', async () => {
    const message = lastMessage(await run({ commandName: 'help' }));
    assert.match(message.text, /\/player add <Name#TAG>/);
    assert.match(message.text, /isn't endorsed by Riot Games/);
    assert.equal(message.components[0].components[0].label, 'Invite');
  });
});

describe('guild lifecycle', () => {
  test('joining creates settings from the server language and posts a welcome once', async () => {
    const sent = [];
    const joined = {
      id: 'guild-2',
      name: 'Nowy Serwer',
      memberCount: 5,
      preferredLocale: 'pl',
      members: { me: {} },
      systemChannel: {
        permissionsFor: () => ({ has: () => true }),
        send: async (payload) => sent.push(payload),
      },
    };
    await guildCreate.execute(joined);
    await guildCreate.execute(joined);
    assert.equal((await db.getGuildConfig('guild-2', 'NA1')).region, 'EUN1');
    assert.equal(sent.length, 1);
    assert.match(sent[0].embeds[0].toJSON().description, /Europe Nordic & East/);

    await db.addPlayer({
      guildId: 'guild-2',
      puuid: 'x',
      platform: 'EUN1',
      gameName: 'X',
      tagLine: 'X1',
    });
    await guildDelete.execute(joined);
    assert.equal(await db.countPlayers('guild-2'), 0);
    assert.equal(await db.GuildConfig.count({ where: { guildId: 'guild-2' } }), 0);
  });

  test('on startup, data of servers that removed the bot while offline is deleted', async () => {
    for (const guildId of ['kept-1', 'kept-2', 'gone']) {
      await db.ensureGuildConfig(guildId, 'EUW1');
      await db.addPlayer({ guildId, puuid: 'p', platform: 'EUW1', gameName: 'P', tagLine: 'P1' });
    }
    const client = {
      shard: null,
      user: { tag: 'Ryze#0001' },
      guilds: {
        cache: new Map([
          ['kept-1', {}],
          ['kept-2', {}],
        ]),
      },
      application: { emojis: { fetch: async () => new Map() } },
    };
    const originalLog = console.log;
    console.log = () => {};
    try {
      await ready.execute(client);
    } finally {
      console.log = originalLog;
    }
    assert.deepEqual((await db.listStoredGuildIds()).sort(), ['kept-1', 'kept-2']);
  });

  test('startup cleanup refuses to wipe most servers (wrong token or database)', async () => {
    for (const guildId of ['a', 'b', 'c']) await db.ensureGuildConfig(guildId, 'EUW1');
    const client = {
      shard: null,
      user: { tag: 'Other#0001' },
      guilds: { cache: new Map([['a', {}]]) },
      application: { emojis: { fetch: async () => new Map() } },
    };
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    try {
      await ready.execute(client);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }
    assert.equal((await db.listStoredGuildIds()).length, 3);
  });
});
