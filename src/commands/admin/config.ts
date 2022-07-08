import { CommandInteraction, MessageEmbedOptions } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { APIApplicationCommandOptionChoice } from 'discord-api-types/v10';
import { COLOR } from '../../shared_assets';
import { getRoleMention } from '../../helperFunctions';
import { commandCategories } from '../../types/enums';
import { MagibotAdminSlashCommand } from '../../types/command';
import {
  getConfiguration,
  getAdminRoles,
  setConfiguration,
} from '../../dbHelpers';
import { setJoinChannel } from './joinsound';

async function setAdminRole(
  guildId: string,
  roleID: string,
  insert: boolean,
): Promise<boolean> {
  const roles = await getAdminRoles(guildId);
  let successful = false;
  if (insert) {
    if (!roles.includes(roleID)) {
      roles.push(roleID);
      successful = true;
    }
  } else {
    const index = roles.indexOf(roleID);
    if (index > -1) {
      roles.splice(index, 1);
      successful = true;
    }
  }
  const configuration = { adminRoles: roles };
  await setConfiguration(guildId, configuration);
  return successful;
}

function printHelp() {
  const info: Array<{ name: string; value: string }> = [];

  info.push({
    name: 'ban <@User>',
    value: 'Deactivate all functions of the bot for a user',
  });
  info.push({
    name: 'unban <@User>',
    value: 'Reactivate all functions of the bot for a user',
  });
  info.push({
    name: 'join',
    value: "(De)activate joinsounds for the voicechannel you're connected to",
  });
  info.push({
    name: 'admin <@Role>',
    value: '(Un)set a role to be considered admin by the bot',
  });
  info.push({
    name: 'command',
    value:
      "(De)activate bot commands for the text channel you're sending this in",
  });
  info.push({
    name: 'notification',
    value: '(Un)set a textchannel to be notification channel',
  });
  info.push({
    name: 'info',
    value: 'Displays current configuration',
  });
  info.push({
    name: 'prefix <prefix>',
    value: 'Set a custom character or string as prefix',
  });

  return info;
}

async function toggleAdminRole(
  interaction: CommandInteraction,
  roleId: string,
  makeAdmin: boolean,
) {
  const success = await setAdminRole(interaction.guildId!, roleId, makeAdmin);
  if (makeAdmin) {
    if (success) {
      interaction.followUp(
        `Successfully set ${getRoleMention(roleId)} as admin role!`,
      );
    } else {
      interaction.followUp(
        `${getRoleMention(roleId)} is already an admin role!`,
      );
    }
  } else if (success) {
    interaction.followUp(
      `Successfully removed ${getRoleMention(roleId)} from the admin roles!`,
    );
  } else {
    interaction.followUp(
      `${getRoleMention(roleId)} wasn't an admin role to begin with!`,
    );
  }
}

async function viewCurrentConfiguration(interaction: CommandInteraction) {
  const guild = interaction.guild!;
  const guildId = guild.id;

  const info: Array<{
    name: string;
    value: string;
    inline: boolean;
  }> = [];
  const configuration = await getConfiguration(guildId);

  let stringifiedAdminRoles = '';
  const { adminRoles } = configuration;
  if (adminRoles.length === 0) {
    stringifiedAdminRoles = 'None';
  } else {
    adminRoles.forEach((role) => {
      stringifiedAdminRoles += `${getRoleMention(role)} `;
    });
  }
  info.push({
    name: 'Admin roles',
    value: stringifiedAdminRoles,
    inline: false,
  });

  let stringifiedJoinsoundChannels = '';
  const { joinChannels } = configuration;
  if (joinChannels.length === 0) {
    stringifiedJoinsoundChannels = 'All';
  } else {
    joinChannels.forEach((channel) => {
      const voiceChannel = guild!.channels.cache.get(channel);
      if (voiceChannel) {
        stringifiedJoinsoundChannels += `${voiceChannel.name}, `;
      } else {
        setJoinChannel(guild!.id, channel, false);
      }
    });
    stringifiedJoinsoundChannels = stringifiedJoinsoundChannels.substring(
      0,
      stringifiedJoinsoundChannels.length - 2,
    );
  }
  info.push({
    name: 'Joinsound channels',
    value: stringifiedJoinsoundChannels,
    inline: false,
  });

  let stringifiedDefaultJoinsound = 'None';
  const { defaultJoinsound } = configuration;
  if (defaultJoinsound) {
    stringifiedDefaultJoinsound = 'Active';
  }
  info.push({
    name: 'Default guild joinsound',
    value: stringifiedDefaultJoinsound,
    inline: false,
  });

  const embed: MessageEmbedOptions = {
    color: COLOR,
    description: `Guild configuration of ${guild.name}:`,
    fields: info,
    footer: {
      iconURL: guild.iconURL() || '',
      text: guild.name,
    },
  };

  interaction.followUp({ embeds: [embed] });
}

const adminRoleCommandChoices: Array<
  APIApplicationCommandOptionChoice<string>
> = [
  { name: 'add to admins', value: 'add' },
  { name: 'remove from admins', value: 'remove' },
];

async function runCommand(interaction: CommandInteraction) {
  const subcommand = interaction.options.getSubcommand(true) as
    | 'adminrole'
    | 'view';

  if (subcommand === 'adminrole') {
    const role = interaction.options.getRole('role', true);
    const makeAdmin = interaction.options.getString('action', true) as
      | 'add'
      | 'remove';
    return toggleAdminRole(interaction, role.id, makeAdmin === 'add');
  }
  if (subcommand === 'view') {
    return viewCurrentConfiguration(interaction);
  }
  return null;
}

function registerSlashCommand(builder: SlashCommandBuilder) {
  return builder.addSubcommandGroup((subcommandGroup) => subcommandGroup
    .setName('config')
    .setDescription('Adjust or view this guilds configuration of the bot.')
    .addSubcommand((subcommand) => subcommand
      .setName('adminrole')
      .setDescription(
        'Add or remove a role that is allowed to use admin commands.',
      )
      .addRoleOption((option) => option
        .setName('role')
        .setDescription('The role you want to add or remove.')
        .setRequired(true))
      .addStringOption((option) => option
        .setName('action')
        .setDescription('If you want to add the role, or remove it.')
        .setChoices(...adminRoleCommandChoices)
        .setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('view')
      .setDescription('View this guilds configuration of the bot.')));
}
export const config: MagibotAdminSlashCommand = {
  help() {
    return printHelp();
  },
  permissions: [],
  category: commandCategories.util,
  run: runCommand,
  registerSlashCommand,
};
