﻿/*  import { PREFIXES, user } from '../shared_assets';
import {
  findMember,
} from '../bamands';

function printHelp() {
  const info : Array<{ name: string; value: string }> = [];

  info.push({
    name: '<@user|userid|nickname>',
    value: 'Strike a user for breaking your server rules. The third strike will lead to a temporary ban.',
  });

  info.push({
    name: 'undo <@user|userid|nickname>',
    value: 'Remove a strike from a user.',
  });

  return info;
}

module.exports = {
  main: async function main(content, msg) {
    // TODO change all of this
    const args = content.split(/ +/);
    const command = args[0].toLowerCase();
    if (msg.guild) {
      const mention = args[1];
      const uid = await findMember(msg.guild, mention);
      if (!(mention && uid)) {
        if (command === 'reset') {
          msg.channel.send('Do you really want to reset all salt on this server?').then((mess) => {
            const filter = (reaction, usr) => (reaction.emoji.name === '☑' || reaction.emoji.name === '❌') && usr.id === msg.author.id;
            mess.react('☑');
            mess.react('❌');
            mess.awaitReactions(filter, {
              max: 1,
              time: 20000,
            }).then((reacts) => {
              mess.delete();
              if (reacts.first() && reacts.first().emoji.name === '☑') {
                data.resetSalt(msg.guild);
                msg.channel.send(`Successfully reset all salt on **${msg.guild.name}**!`);
              } else if (reacts.first()) {
                msg.channel.send('Successfully canceled salt reset.');
              }
            });
          });
          return;
        }
        msg.reply('you need to mention a user you want to use this on!');
        return;
      }
      switch (command) {
      case 'add':
        if (uid === user().id) {
          msg.reply("you can't report me!");
          return;
        }
        await data.saltUpAdmin(uid, msg.author.id, msg.guild);
        msg.channel.send(`Successfully reported <@!${uid}> for being a salty bitch!`);
        break;
      case 'rem':
        if (await data.remOldestSalt(uid, msg.guild)) {
          msg.channel.send(`Successfully removed the oldest salt from <@!${uid}>!`);
        } else {
          msg.channel.send(`<@!${uid}> has no salt that could be removed!`);
        }
        break;
      case 'clr':
        await data.clrSalt(uid, msg.guild);
        msg.channel.send(`Successfully cleared all salt from <@!${uid}>!`);
        break;
      default:
        msg.reply(`this command doesn't exist. Use \`${PREFIXES.get(msg.guild.id)}:help salt\` to get more info.`);
        break;
      }
    } else {
      msg.reply('Commands are only available on guilds.');
    }
  },
  ehelp() {
    return printHelp();
  },
  perm: 'SEND_MESSAGES',
  admin: true,
  hide: false,
  category: 'Utility',
};

 */

// so that TS doesnt have any issues:
export {};
