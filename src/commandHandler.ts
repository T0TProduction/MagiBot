import Discord from 'discord.js';
// import { help } from './commands/old/help'; // eslint-disable-line import/no-cycle
import { PREFIXES, user } from './shared_assets';
import { magibotCommand } from './types/command';
import { getCommandChannels, getUser } from './dbHelpers';
import { notifyAboutSlashCommand } from './helperFunctions';

export const commands: { [k: string]: magibotCommand } = {
  // help,
};

const migratedCommands = new Map([
  ['rfact', 'randomfact'],
  ['bug', 'bugreport'],
  ['invite', 'invite'],
  ['ping', 'ping'],
  ['roll', 'roll'],
  ['salt', 'salt'],
  ['profile', 'profile'],
  ['_salt', 'salt'], // admin command
  ['_sound', 'joinsound'], // admin command
  ['sound', 'joinsound'],
  ['info', 'info'],
  ['vote', 'vote'],
  ['_queue', 'queue'], // admin command
  ['_setup', 'config'], // admin command
  ['help', 'help'],
]);

async function sendMigrationMessageIfComandHasBeenMigrated(
  message: Discord.Message,
  commandName: string,
  isAdminCommand = false,
) {
  const migratedCommand = migratedCommands.get(commandName);
  if (migratedCommand) {
    await notifyAboutSlashCommand(
      message,
      isAdminCommand ? `admin ${migratedCommand}` : migratedCommand,
    );
  }
}

export async function commandAllowed(guildID: string, channelId?: string) {
  if (!channelId) {
    return false;
  }
  const channels = await getCommandChannels(guildID);
  return channels.length === 0 || channels.includes(channelId);
}

export async function usageUp(userid: string, guildID: string) {
  const usr = await getUser(userid, guildID);
  const updateval = usr.botusage + 1;
  usr.botusage = updateval;
  await usr.save();
}

export async function printCommandChannels(guildID: string) {
  const channels = await getCommandChannels(guildID);
  let out = '';
  channels.forEach((channel: string) => {
    out += ` <#${channel}>`;
  });
  return out;
}

export async function checkCommand(message: Discord.Message) {
  if (!(message.author && message.guild && message.guild.me)) {
    // check for valid message
    console.error('Invalid message received:', message);
    return;
  }
  // only read guild messages from non-bots
  if (!(!message.author.bot && message.channel.type === 'GUILD_TEXT')) {
    return;
  }
  let isMention: boolean;
  if (
    message.content.startsWith(`<@${user().id}>`)
    || message.content.startsWith(`<@!${user().id}>`)
  ) {
    isMention = true;
  } else if (message.content.startsWith(PREFIXES.get(message.guild.id)!)) {
    isMention = false;
  } else {
    return;
  }
  let command: string;
  if (isMention) {
    command = message.content.split(' ')[1]; // eslint-disable-line prefer-destructuring
    command = `.${command}`;
  } else {
    command = message.content
      .substring(PREFIXES.get(message.guild.id)!.length, message.content.length)
      .split(' ')[0]
      .toLowerCase();
  }
  if (command) {
    const pre = command.charAt(0);

    if (pre === '.') {
      command = command.slice(1);
    } else if (pre === ':') {
      command = `_${command.slice(1)}`;
      // Check if its an admin command
      // if not you're allowed to use the normal version as admin (in any channel)
      if (!commands[command]) {
        command = command.slice(1);
      }
      // Check if the command exists, to not just spam k: msgs
      if (!commands[command]) {
        await sendMigrationMessageIfComandHasBeenMigrated(
          message,
          command,
          true,
        );
      }
      return;
    } else {
      return;
    }
    if (!commands[command]) {
      await sendMigrationMessageIfComandHasBeenMigrated(message, command);
    }
  }
}
