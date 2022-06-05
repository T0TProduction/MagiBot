import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { isShadowBanned, shadowBannedLevel } from '../shared_assets';
import { commandCategories } from '../types/enums';
import { DeferReply, MagibotSlashCommand } from '../types/command';
import {
  JoinsoundOptions,
  removeDefaultSound,
  removeSound,
  validateAndSaveJoinsound,
} from './joinsounds/management';

function printHelp() {
  const info: Array<{ name: string; value: string }> = [];
  info.push({
    name: '(and attach soundfile to this command)',
    value:
      'Set up a joinsound for yourself. Only .mp3 and .wav are being supported at the moment.\nRemember to attach the sound file to the message you use this command in.',
  });
  info.push({
    name: 'default (and attach soundfile to this command)',
    value:
      'Set up a default joinsound for yourself. This will play for you on every server MagiBot is on, until you override it with a sound there.\nOnly .mp3 and .wav are being supported at the moment.\nRemember to attach the sound file to the message you use this command in.',
  });
  info.push({
    name: 'rem',
    value: 'Remove your joinsound',
  });
  info.push({
    name: 'rem default',
    value: 'Remove your default joinsound',
  });

  return info;
}

const slashCommand = new SlashCommandBuilder()
  .setName('joinsound')
  .setDescription('Manage your joinsounds.')
  .addSubcommand((subcommand) => subcommand
    .setName('set')
    .setDescription('Set your joinsound.')
    .addAttachmentOption((option) => option
      .setName(JoinsoundOptions.soundFile)
      .setDescription(
        'The sound you want to use. Mp3 or wav, max length of 8 seconds.',
      ))
    .addStringOption((option) => option
      .setName(JoinsoundOptions.directUrl)
      .setDescription(
        'A direct link to the sound you want to use. Max length of 8 seconds.',
      )))
  .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove your joinsound.'))
  .addSubcommand((subcommand) => subcommand
    .setName('set-default')
    .setDescription('Set your default joinsound.')
    .addAttachmentOption((option) => option
      .setName(JoinsoundOptions.soundFile)
      .setDescription(
        'The sound you want to use per default in all guilds. Mp3 or wav, max length of 8 seconds.',
      )
      .setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('remove-default')
    .setDescription('Remove your default joinsound.'));

async function getSoundFromInteraction(interaction: CommandInteraction) {
  const attachment = interaction.options.getAttachment(
    JoinsoundOptions.soundFile,
  );
  if (attachment) {
    return attachment;
  }
  const fileUrl = interaction.options.getString(JoinsoundOptions.directUrl);
  if (fileUrl) {
    return fileUrl;
  }

  interaction.followUp('You need to either pass a file or URL!');
  return null;
}

async function runCommand(interaction: CommandInteraction) {
  const { user } = interaction.member!;
  const guild = interaction.guild!;
  if (
    isShadowBanned(user.id, guild.id, guild.ownerId) !== shadowBannedLevel.not
  ) {
    interaction.followUp('You cant do this.');
    return;
  }
  const subcommand = interaction.options.getSubcommand(true) as
    | 'set'
    | 'set-default'
    | 'remove'
    | 'remove-default';

  if (subcommand === 'set') {
    const attachment = await getSoundFromInteraction(interaction);
    if (!attachment) {
      return;
    }
    await validateAndSaveJoinsound(attachment, interaction, false);
    return;
  }
  if (subcommand === 'set-default') {
    const attachment = await getSoundFromInteraction(interaction);
    if (!attachment) {
      return;
    }
    await validateAndSaveJoinsound(attachment, interaction, true);
    return;
  }
  if (subcommand === 'remove') {
    await removeSound(user.id, guild.id);
    interaction.followUp('Successfully removed your joinsound!');
    return;
  }
  if (subcommand === 'remove-default') {
    await removeDefaultSound(user.id);
    interaction.followUp('Successfully removed your default joinsound!');
  }
}
export const joinsound: MagibotSlashCommand = {
  help() {
    return printHelp();
  },
  permissions: [],
  category: commandCategories.fun,
  definition: slashCommand.toJSON(),
  run: runCommand,
  defer: DeferReply.public,
};
