﻿// commands made by Basti for use of the Bot
// we need this in here to get channels, so dependency cycle isnt a problem
import Discord from 'discord.js';
import { bot } from './bot';

export async function findMember(guild:Discord.Guild, ment:string) {
  if (!ment) {
    return false;
  }
  const mention = ment.toLowerCase();
  if (mention.startsWith('<@') && mention.endsWith('>')) {
    let id = mention.slice(2, -1);
    if (id.startsWith('!')) {
      id = id.substr(1);
    }
    return id;
  }
  const user = guild.member(mention);
  if (user) {
    return user.id;
  }
  if (mention.length >= 3) {
    let memberArray = guild.members.filter(
      (memb) => memb.displayName.toLowerCase().startsWith(mention),
    );
    if (memberArray.size === 1) {
      return memberArray[0].id;
    }
    if (memberArray.size === 0) {
      memberArray = guild.members.filter(
        (memb) => memb.displayName.toLowerCase().includes(mention),
      );
      if (memberArray.size === 1) {
        return memberArray[0].id;
      }
    }
  }
  return false;
}

export async function findRole(guild:Discord.Guild, ment:string) {
  if (!ment) {
    return false;
  }
  const mention = ment.toLowerCase();
  if (mention.startsWith('<@&') && mention.endsWith('>')) {
    const id = mention.substr(3).slice(0, -1);
    return id;
  }
  const role = await guild.roles.get(mention);
  if (role) {
    return role.id;
  }
  if (mention.length >= 3) {
    let roleArray = await guild.roles.filter((rol) => rol.name.toLowerCase().startsWith(mention));
    if (roleArray.size === 1) {
      return roleArray[0].id;
    }
    if (roleArray.size === 0) {
      roleArray = await guild.roles.filter((rol) => rol.name.toLowerCase().includes(mention));
      if (roleArray.size === 1) {
        return roleArray[0].id;
      }
    }
  }
  return false;
}
// this is an idea to implement rather reusable confirmation processes.
// ; abortMessage, timeoutMessage and time are optional parameters
export async function yesOrNo(
  msg:Discord.Message, question:string, abortMessage?:string, timeoutMessage?:string, tim?:number,
) {
  return msg.channel.send(question).then(async (mess) => {
    const filter = (reaction:Discord.MessageReaction, user:Discord.User) => (reaction.emoji.name === '☑' || reaction.emoji.name === '❌') && user.id === msg.author.id;
    await mess.react('☑');
    await mess.react('❌');
    let time = tim;
    if (!time) {
      time = 20000;
    }
    return mess.awaitReactions(filter, { max: 1, time }).then(async (reacts) => {
      mess.delete();
      const firstReacts = reacts.first();
      if (firstReacts && firstReacts.emoji.name === '☑') {
        return true;
      } if (firstReacts) {
        if (abortMessage) {
          msg.channel.send(abortMessage);
        }
        return false;
      }
      let message = timeoutMessage;
      if (!message) {
        message = 'Cancelled due to timeout.';
      }
      await msg.channel.send(message);
      return false;
    });
  });
}

export function printError(error) {
  console.error(`Errorstatus: ${error.response.status} ${error.response.statusText}`);
};

export function catchErrorOnDiscord(err) {
  try {
    const chann = bot.channels.get('414809410448261132');
    if (chann) {
      (chann as Discord.TextChannel).send(`Caught error: ${err}`);
    }
  } catch (error) {
    console.error(error);
  }
}
