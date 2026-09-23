const { Events, MessageFlags, RESTJSONErrorCodes } = require('discord.js');

const { errorEmbed } = require('../utils/embeds.js');
const { UserError, toUserMessage } = require('../utils/errors.js');

const logError = (label, error) => {
  // Expected, user-facing problems (typos, missing tags...) are not worth a stack trace.
  if (error instanceof UserError) return;
  console.error(`[interaction] ${label} failed:`, error);
};

const replyWithError = async (interaction, error) => {
  const embeds = [errorEmbed(toUserMessage(error))];
  try {
    if (interaction.isMessageComponent()) {
      // Never overwrite the message the button lives on; tell only the person who clicked.
      const method = interaction.deferred || interaction.replied ? 'followUp' : 'reply';
      await interaction[method]({ embeds, flags: MessageFlags.Ephemeral });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ embeds, components: [] });
    } else if (interaction.replied) {
      await interaction.followUp({ embeds, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
    }
  } catch (replyError) {
    if (replyError.code !== RESTJSONErrorCodes.UnknownInteraction) {
      console.error('[interaction] Could not send error message:', replyError);
    }
  }
};

const run = async (interaction, label, handler) => {
  try {
    await handler();
  } catch (error) {
    logError(label, error);
    await replyWithError(interaction, error);
  }
};

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const { commands } = interaction.client;

    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      try {
        await command?.autocomplete?.(interaction);
      } catch (error) {
        console.error(`[interaction] Autocomplete for /${interaction.commandName} failed:`, error);
        if (!interaction.responded) await interaction.respond([]).catch(() => {});
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        console.error(`[interaction] No command matching /${interaction.commandName}`);
        return;
      }
      await run(interaction, `/${interaction.commandName}`, () => command.execute(interaction));
      return;
    }

    // Buttons and menus use custom IDs shaped like "<command>:<arg>:<arg>".
    if (interaction.isMessageComponent()) {
      const [commandName, ...args] = interaction.customId.split(':');
      const command = commands.get(commandName);
      if (!command?.handleComponent) return;
      await run(interaction, `component ${interaction.customId}`, () =>
        command.handleComponent(interaction, args)
      );
    }
  },
};
