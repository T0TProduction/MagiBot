﻿import Discord from 'discord.js';
import fs from 'fs';
import blapi from 'blapi';
import config from './token';
import data from './db';

import bamands from './bamands';

export type magibotClient = {
  bot:Discord.Client,
  OWNERID: string;
  PREFIX: string;
  TOKEN: string;
  DETAILED_LOGGING: boolean;
  DELETE_COMMANDS: boolean;
  COLOR: number;
  SUCCESS_COLOR: number;
  ERROR_COLOR: number;
  INFO_COLOR: number;
  SIGN :string;
  PREFIXES: {
  [k:string]:string,
  },
  queueVoiceChannels: any, // TODO
  sendNotification: (info:string, type:string, msg:Discord.Message)=> void,
};

const bot = new Discord.Client();
const magibot: magibotClient = {
  bot,
  // global variables saved in bot
  // TODO maybe we want to have these in their own file and export them
  OWNERID: config.owner,
  PREFIX: config.prefix,
  TOKEN: config.tk,
  DETAILED_LOGGING: false,
  DELETE_COMMANDS: false,
  COLOR: 0x351c75,
  SUCCESS_COLOR: 0x00ff00,
  ERROR_COLOR: 0x0000ff,
  INFO_COLOR: 0x0000ff,
  SIGN: 'MagiBot - created by T0TProduction#0001',
  PREFIXES: {},
  queueVoiceChannels: {},
  sendNotification: function sendNotification(info:string, type:string, msg:Discord.Message) {
    let icolor:number|undefined;

    if (type === 'success') icolor = magibot.SUCCESS_COLOR;
    else if (type === 'error') icolor = magibot.ERROR_COLOR;
    else if (type === 'info') icolor = magibot.INFO_COLOR;
    else icolor = magibot.COLOR;

    const embed = {
      color: icolor,
      description: info,
    };
    msg.channel.send('', { embed });
  },
}; // TODO add the rest

const userCooldowns = new Set();

// post to the APIs every 30 minutes
if (config.blapis) {
  blapi.handle(bot as any, config.blapis, 30);
  // TODO fix blapi types!
}
process.on('uncaughtException', (err) => {
  const chann = bot.channels.get('414809410448261132');

  console.error(`Uncaught Exception:\n${err.stack ? err.stack : err}`);
  if (chann) {
    (chann as Discord.TextChannel).send(`**Outer Uncaught Exception:**\n\`\`\`${err.stack ? err.stack : err}\`\`\``);
  }
});
process.on('unhandledRejection', (err) => {
  const chann = bot.channels.get('414809410448261132');

  console.error(`Unhandled promise rejection:\n${err}`);
  if (chann) {
    (chann as Discord.TextChannel).send(`**Outer Unhandled promise rejection:**\n\`\`\`${err}\`\`\``);
  }
});


const commands = {};
// TODO actually use
const commandCategories = ['Utility', 'Fun', 'Game', 'Miscellaneous'];

commands.help = {};
commands.help.args = '';
commands.help.help = 'Shows all available commands';
commands.help.admin = false;
commands.help.perm = 'SEND_MESSAGES';
commands.help.main = async function main(bo, msg) {
  const args = msg.content.split(/ +/);
  let command = args[0].toLowerCase();
  // extended help
  if (command) {
    const acommand = `@${command}`;
    if (!(commands[command] || commands[acommand])) {
      msg.reply(
        `this command does not exist. Use \`${
          bot.PREFIXES[msg.guild.id]
        }.help\` to get a full list of the commands available.`,
      );
    } else if (commands[command]) {
      if (commands[command].ehelp) {
        let info = [];
        let ehelps = commands[command].ehelp(msg, bot);
        for (const i in ehelps) {
          info.push({
            name: `${bot.PREFIXES[msg.guild.id]}.${command} ${ehelps[i].name}`,
            value: ehelps[i].value,
            inline: false,
          });
        }
        let embed = {
          color: bot.COLOR,
          description: `Commands available via the prefix \`${
            bot.PREFIXES[msg.guild.id]
          }.${command}\`:`,
          fields: info,
          footer: {
            /* eslint-disable camelcase */
            icon_url: bot.user.avatarURL,
            /* eslint-enable camelcase */
            text:
              '<required input> , [optional input] , choose|one|of|these , (comment on the command)',
          },
        };

        msg.channel.send('', { embed });
        // admin variant?
        if (msg.member && (await data.isAdmin(msg.guild.id, msg.member, bot))) {
          if (commands[acommand] && commands[acommand].ehelp) {
            info = [];
            ehelps = commands[acommand].ehelp(msg, bot);
            for (const i in ehelps) {
              info.push({
                name: `${bot.PREFIXES[msg.guild.id]}:${acommand.slice(1)} ${
                  ehelps[i].name
                }`,
                value: ehelps[i].value,
                inline: false,
              });
            }

            embed = {
              color: bot.COLOR,
              description: `Admin commands available via the prefix \`${
                bot.PREFIXES[msg.guild.id]
              }:${command}\`:`,
              fields: info,
              footer: {
                /* eslint-disable camelcase */
                icon_url: bot.user.avatarURL,
                /* eslint-enable camelcase */
                text:
                  '<required input> , [optional input] , choose|one|of|these , (comment on the command)',
              },
            };

            msg.channel.send('', { embed });
          }
        }
      } else {
        msg.reply('there is no extended help available for this command.');
      }
    } else if (
      msg.member
      && (await data.isAdmin(msg.guild.id, msg.member, bot))
    ) {
      // Only Admin command
      command = acommand;
      if (commands[command].ehelp) {
        const info = [];
        const ehelps = commands[command].ehelp(msg, bot);
        for (const i in ehelps) {
          info.push({
            name: `${bot.PREFIXES[msg.guild.id]}:${command.slice(1)} ${
              ehelps[i].name
            }`,
            value: ehelps[i].value,
            inline: false,
          });
        }
        const embed = {
          color: bot.COLOR,
          description: `Admin commands available via the prefix \`${
            bot.PREFIXES[msg.guild.id]
          }:${command.slice(1)}\`:`,
          fields: info,
          footer: {
            /* eslint-disable camelcase */
            icon_url: bot.user.avatarURL,
            /* eslint-enable camelcase */
            text:
              '<required input> , [optional input] , choose|one|of|these , (comment on the command)',
          },
        };

        msg.channel.send('', { embed });
      } else {
        msg.reply('there is no extended help available for this command.');
      }
    }
  } else {
    // normal help, sort by categories
    let cmds = [];
    for (const i in commandCategories) {
      const cat = commandCategories[i];
      let coms = '';
      for (const commnd in commands) {
        if (
          commands[commnd].category == cat
          && !(commands[commnd].hide || commands[commnd].admin)
        ) {
          let nm = commnd;
          if (commands[commnd].dev) {
            nm += '(dev only)';
          }
          coms += `${nm}, `;
        }
      }
      if (coms != '') {
        coms = coms.slice(0, -2);
        cmds.push({
          name: `${cat} commands`,
          value: coms,
          inline: false,
        });
      }
    }
    let embed = {
      color: bot.COLOR,
      description: `Commands available via the prefix \`${
        bot.PREFIXES[msg.guild.id]
      }.\` :\nto get more info on a single command use \`${
        bot.PREFIXES[msg.guild.id]
      }.help <command>\``,
      fields: cmds,
      footer: {
        /* eslint-disable camelcase */
        icon_url: bot.user.avatarURL,
        /* eslint-enable camelcase */
        text: `admins can override commands with ${
          bot.PREFIXES[msg.guild.id]
        }: instead of ${
          bot.PREFIXES[msg.guild.id]
        }. to ignore command channel restrictions`,
      },
    };
    msg.channel.send('', { embed });
    if (msg.member && (await data.isAdmin(msg.guild.id, msg.member, bot))) {
      cmds = [];
      let coms = '';
      for (const commnd in commands) {
        if (commands[commnd].admin && !commands[commnd].hide) {
          let nm = commnd.substr(1, commnd.length);
          if (commands[commnd].dev) {
            nm += '(dev only)';
          }
          coms += `${nm}, `;
        }
      }
      if (coms != '') {
        coms = coms.slice(0, -2);
        cmds.push({
          name: 'Admin commands',
          value: coms,
          inline: false,
        });
      }
      embed = {
        color: bot.COLOR,
        description: `Admin commands available via the prefix \`${
          bot.PREFIXES[msg.guild.id]
        }:\` :\nto get more info on a single command use \`${
          bot.PREFIXES[msg.guild.id]
        }.help <command>\``,
        fields: cmds,
        footer: {
          /* eslint-disable camelcase */
          icon_url: bot.user.avatarURL,
          /* eslint-enable camelcase */
          text: `admins can override commands with ${
            bot.PREFIXES[msg.guild.id]
          }: instead of ${
            bot.PREFIXES[msg.guild.id]
          }. to ignore command channel restrictions`,
        },
      };
      msg.channel.send('', { embed });
    }
  }
};

commands.load = {};
commands.load.args = '<command>';
commands.load.help = '';
commands.load.hide = true;
commands.load.admin = false;
commands.load.dev = true;
commands.load.main = function main(bo, msg) {
  if (msg.author.id == bot.OWNERID) {
    try {
      delete commands[msg.content];
      delete require.cache[`${__dirname}/commands/${msg.content}.js`];
      commands[
        msg.content
      ] = require(`${__dirname}/commands/${msg.content}.js`);
      bot.sendNotification(
        `Loaded ${msg.content}.js succesfully.`,
        'success',
        msg,
      );
    } catch (err) {
      bot.sendNotification(
        'The command was not found, or there was an error loading it.',
        'error',
        msg,
      );
    }
  } else {
    bot.sendNotification("You're not allowed to use this..", 'error', msg);
  }
};

commands.unload = {};
commands.unload.args = '<command>';
commands.unload.help = '';
commands.unload.hide = true;
commands.unload.dev = true;
commands.unload.admin = false;
commands.unload.main = function main(bo, msg) {
  if (msg.author.id == bot.OWNERID) {
    try {
      delete commands[msg.content];
      delete require.cache[`${__dirname}/commands/${msg.content}.js`];
      bot.sendNotification(
        `Unloaded ${msg.content}.js succesfully.`,
        'success',
        msg,
      );
    } catch (err) {
      bot.sendNotification('Command not found.', 'error', msg);
    }
  } else {
    bot.sendNotification("You're not allowed to use this..", 'error', msg);
  }
};

commands.reload = {};
commands.reload.args = '';
commands.reload.help = '';
commands.reload.hide = true;
commands.reload.dev = true;
commands.reload.admin = false;
commands.reload.main = function main(bo, msg) {
  if (msg.author.id == bot.OWNERID) {
    try {
      delete commands[msg.content];
      delete require.cache[`${__dirname}/commands/${msg.content}.js`];
      // commands[args] = require(`${__dirname}/commands/${msg.content}.js`); this line seems wrong but is never used anyways
      bot.sendNotification(
        `Reloaded ${msg.content}.js successfully.`,
        'success',
        msg,
      );
    } catch (err) {
      msg.channel.send('Command not found');
    }
  } else {
    bot.sendNotification("You're not allowed to use this..", 'error', msg);
  }
};

const loadCommands = function () {
  const files = fs.readdirSync(`${__dirname}/commands`);
  for (const file of files) {
    if (file.endsWith('.js')) {
      commands[file.slice(0, -3)] = require(`${__dirname}/commands/${file}`);
      if (bot.DETAILED_LOGGING) {
        console.log(`Loaded ${file}`);
      }
    }
  }
  console.log('———— All Commands Loaded! ————');
};

const checkCommand = async function (msg, isMention) {
  try {
    // ignore blacklisted users
    if (await data.isBlacklistedUser(await msg.author.id, await msg.guild.id)) {
      msg.delete();
      return;
    }
    let command;
    if (isMention) {
      command = msg.content.split(' ')[1];
      msg.content = msg.content
        .split(' ')
        .splice(2, msg.content.split(' ').length)
        .join(' ');
      command = `.${command}`;
    } else {
      command = msg.content
        .substring(bot.PREFIXES[msg.guild.id].length, msg.content.length)
        .split(' ')[0]
        .toLowerCase();
      msg.content = msg.content.slice(
        command.length + bot.PREFIXES[msg.guild.id].length,
      ); // delete prefix and command
      msg.content = msg.content.replace(/^\s+/g, ''); // delete leading spaces
    }
    if (command) {
      let commandVal;
      const pre = command.charAt(0);
      switch (pre) {
      case '.':
        command = command.slice(1);
        commandVal = command;
        break;
      case ':':
        command = `@${command.slice(1)}`;
        commandVal = command.slice(1);
        // Check if its an admin command, if not you're allowed to use the normal version as admin (in any channel)
        if (!commands[command]) {
          command = command.slice(1);
        }
        // Check if the command exists, to not just spam k: messages
        if (commands[command]) {
          if (
            !(
              msg.member
                && (await data.isAdmin(msg.guild.id, msg.member, bot))
            )
          ) {
            if (
              await msg.channel
                .permissionsFor(msg.guild.me)
                .has('MANAGE_MESSAGES')
            ) {
              msg.delete();
            }
            if (
              await msg.channel
                .permissionsFor(msg.guild.me)
                .has('SEND_MESSAGES')
            ) {
              msg
                .reply("you're not allowed to use this command.")
                .then((mess) => mess.delete(5000));
            }
            return;
          }
        } else {
          return;
        }
        break;
      default:
        return;
      }
      if (
        commands[command]
        && (!commands[command].dev || msg.author.id == bot.OWNERID)
      ) {
        if (
          pre == ':'
          || (await data.commandAllowed(msg.guild.id, msg.channel.id))
        ) {
          const perms = commands[command].perm;
          if (
            !perms
            || (await msg.channel.permissionsFor(msg.guild.me).has(perms))
          ) {
            // cooldown for command usage
            if (!userCooldowns.has(msg.author.id)) {
              userCooldowns.add(msg.author.id);
              setTimeout(() => {
                userCooldowns.delete(msg.author.id);
              }, 4000);
              try {
                await commands[command].main(bot, msg);
              } catch (err) {
                bamands.catchError(
                  err,
                  bot,
                  msg,
                  `${bot.PREFIXES[msg.guild.id]}${pre}${commandVal}`,
                );
              }
              data.usageUp(msg.author.id, msg.guild.id);
            } else if (
              await msg.channel
                .permissionsFor(msg.guild.me)
                .has('SEND_MESSAGES')
            ) {
              msg.reply("whoa cool down, you're using commands too quick!");
            }
            // endof cooldown management
          } else if (
            await msg.channel.permissionsFor(msg.guild.me).has('SEND_MESSAGES')
          ) {
            msg.channel.send(
              `I don't have the permissions needed for this command. (${perms}) `,
            );
          }
        } else if (
          await msg.channel.permissionsFor(msg.guild.me).has('SEND_MESSAGES')
        ) {
          if (
            await msg.channel
              .permissionsFor(msg.guild.me)
              .has('MANAGE_MESSAGES')
          ) {
            msg.delete();
          }
          msg
            .reply(
              `commands aren't allowed in <#${
                msg.channel.id
              }>. Use them in ${await data.commandChannel(
                msg.guild.id,
              )}. If you're an admin use \`${
                bot.PREFIX
              }:help\` to see how you can change that.`,
            )
            .then((mess) => mess.delete(15000));
        }
      }
    }
  } catch (err) {
    bamands.catchErrorOnDiscord(bot, `in check command: ${err}`);
  }
};
// fires on startup and on reconnect
let justStartedUp = true;
bot.on('ready', () => {
  const chann = bot.channels.get('382233880469438465');
  if (justStartedUp) {
    if (chann && chann.type === 'text') {
      (chann as Discord.TextChannel).send('Running startup...');
    } else {
      console.error('Tebots Server Channel not found.');
    }
    data.startup(bot);
    justStartedUp = false;
  } else {
    chann.send('Just reconnected to Discord...');
  }
  bot.user.setPresence({
    game: {
      name: `${bot.PREFIX}.help`,
      type: 'watching',
      url: 'https://bots.ondiscord.xyz/bots/384820232583249921',
    },
    status: 'online',
  });
  data.getPrefixesE(bot);
});

bot.on('message', (msg) => {
  if (!msg.author.bot && msg.guild) {
    if (
      msg.content.startsWith(`<@${bot.user.id}>`)
      || msg.content.startsWith(`<@!${bot.user.id}>`)
    ) {
      checkCommand(msg, true);
      if (bot.DELETE_COMMANDS) msg.delete();
    } else if (msg.content.startsWith(bot.PREFIXES[msg.guild.id])) {
      checkCommand(msg, false);
      if (bot.DELETE_COMMANDS) msg.delete();
    }
  }
});

async function guildPrefixStartup(guild) {
  try {
    await data.addGuild(guild.id);
    bot.PREFIXES[guild.id] = await data.getPrefixE(guild.id);
  } catch (err) {
    bamands.catchErrorOnDiscord(bot, `in guildPrefixStartup: ${err}`);
  }
}

bot.on('guildCreate', (guild) => {
  if (guild.available) {
    guildPrefixStartup(guild);
    guild.owner
      .send(
        `Hi there ${guild.owner.displayName}.\nThanks for adding me to your server! If you have any need for help or want to help develop the bot by reporting bugs and requesting features, just join https://discord.gg/2Evcf4T\n\nTo setup the bot, use \`${bot.PREFIX}:help setup\`.\nYou should:\n\t- setup an admin role, as only you and users with administrative permission are able to use admin commands (\`${bot.PREFIX}:setup admin @role\`)\n\t- add some text channels where users can use the bot (\`${bot.PREFIX}:setup command\`)\n\t- add voice channels in which the bot is allowed to `
          + `join to use joinsounds (\`${bot.PREFIX}:setup join\`)\n\t- add a notification channel where bot updates and information will be posted (\`${bot.PREFIX}:setup notification\`)\n\nTo make sure the bot can use all its functions consider giving it a role with administrative rights, if you have not done so yet in the invitation.\n\nThanks for being part of this project,\nBasti aka. the MagiBot Dev`,
      )
      .catch(() => {});
    const chan = bot.channels.get('408611226998800390');
    if (chan) {
      chan.send(
        `:white_check_mark: joined **${guild.name}** from ${guild.region} (${guild.memberCount} users, ID: ${guild.id})\nOwner is: <@${guild.ownerID}> (ID: ${guild.ownerID})`,
      );
    }
  }
});

bot.on('guildDelete', (guild) => {
  if (guild.available) {
    const chan = bot.channels.get('408611226998800390');
    if (chan) {
      chan.send(
        `:x: left ${guild.name} (${guild.memberCount} users, ID: ${guild.id})`,
      );
    }
  }
});

bot.on('error', (err) => {
  bamands.catchErrorOnDiscord(bot, err);
  console.log(err);
});

bot.on('voiceStateUpdate', async (o, n) => {
  try {
    const newVc = n.voiceChannel;
    // check if voice channel actually changed, don't mute bots
    if (
      !n.user.bot
      && (!o.voiceChannel || o.voiceChannelID != n.voiceChannelID)
    ) {
      // is muted and joined a vc? maybe still muted from queue
      if (
        n.serverMute
        && n.voiceChannel
        && (await data.isStillMuted(n.id, n.guild.id))
      ) {
        n.setMute(
          false,
          'was still muted from a queue which user disconnected from',
        );
        data.toggleStillMuted(n.id, n.guild.id, false);
      }
      if (
        !n.serverMute
        && n.voiceChannel
        && bot.queueVoiceChannels[n.guild.id]
        && bot.queueVoiceChannels[n.guild.id] == n.voiceChannelID
      ) {
        // user joined a muted channel
        n.setMute(true, 'joined active queue voice channel');
      } else if (
        n.serverMute
        && o.voiceChannel
        && bot.queueVoiceChannels[o.guild.id]
        && bot.queueVoiceChannels[o.guild.id] == o.voiceChannelID
      ) {
        // user left a muted channel
        if (n.voiceChannel) {
          n.setMute(false, 'left active queue voice channel');
        } else {
          // save the unmute for later
          data.toggleStillMuted(n.id, n.guild.id, true);
        }
      } else if (
        newVc
        && !n.guild.me.voiceChannel
        && n.id != bot.user.id
        && !(await data.isBlacklistedUser(n.id, n.guild.id))
        && (await data.joinable(n.guild.id, n.voiceChannelID))
      ) {
        if (newVc.permissionsFor(n.guild.me).has('CONNECT')) {
          const sound = await data.getSound(n.id, n.guild.id);
          if (sound) {
            newVc.join().then((connection) => {
              if (connection) {
                // TODO use connection.play when discord.js updates
                const dispatcher = connection.playArbitraryInput(sound, {
                  seek: 0,
                  volume: 0.2,
                  passes: 1,
                  bitrate: 'auto',
                });
                dispatcher.once('end', () => {
                  connection.disconnect();
                  dispatcher.removeAllListeners(); // To be sure noone listens to this anymore
                });
                dispatcher.once('error', () => {
                  connection.disconnect();
                  dispatcher.removeAllListeners(); // To be sure noone listens to this anymore
                });
              }
            });
          }
        }
      }
    }
  } catch (err) {
    bamands.catchErrorOnDiscord(bot, `in voice update: ${err}`);
  }
});

bot.on('disconnected', () => {
  console.log('Disconnected!');
});

loadCommands(); // load all commands
bot.login(bot.TOKEN); // connect to discord
