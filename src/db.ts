﻿import { MongoClient, Db } from 'mongodb';
import {
  Client, TextChannel, Message, Guild, GuildMember,
} from 'discord.js';
import { OWNERID, PREFIXES, resetPrefixes } from './shared_assets';
import { asyncForEach } from './bamands';
import config from './token';

if (!config.dburl) {
  throw new Error('Missing DB connection URL');
}
const url = config.dburl;

const mclient = MongoClient.connect(url, { poolSize: 20, ssl: true });
let db: Db;
mclient.then((m) => {
  db = m.db('MagiBot');
});

// Define Methods:
async function getuser(userid: string, guildID: string) {
  const result = await db.collection('users').findOneAndUpdate(
    { userID: userid, guildID },
    {
      $setOnInsert: {
        warnings: 0,
        kicks: 0,
        bans: 0,
        botusage: 0,
        sound: false,
      },
    },
    { returnOriginal: false, upsert: true },
  );
  return result.value;
}
// eslint-disable-next-line require-await
async function saltGuild(salter, guildID: string, add = 1, reset = false) {
  const user = await db
    .collection('saltrank')
    .findOne({ salter, guild: guildID });
  if (!user) {
    const myobj = { salter, salt: 1, guild: guildID };
    await db.collection('saltrank').insertOne(myobj);
  } else {
    const slt = user.salt + add;
    if (slt <= 0 || reset) {
      await db.collection('saltrank').deleteOne({ salter, guild: guildID });
    } else {
      const update = { $set: { salt: slt } };
      await db
        .collection('saltrank')
        .updateOne({ salter, guild: guildID }, update);
    }
  }
}
// eslint-disable-next-line require-await
async function addSalt(userid: string, reporter: string, guildID: string) {
  const date = new Date();
  const myobj = {
    salter: userid,
    reporter,
    date,
    guild: guildID,
  };
  return db
    .collection('salt')
    .insertOne(myobj)
    .then(async () => {
      await saltGuild(userid, guildID, 1);
      return 0;
    });
}
async function updateUser(userid: string, update, guildID: string) {
  await db.collection('users').updateOne({ userID: userid, guildID }, update);
}
async function saltDowntimeDone(userid1: string, userid2: string) {
  // get newest entry in salt
  const d2 = await db
    .collection('salt')
    .find<{ date: Date }>({ salter: userid1, reporter: userid2 })
    .sort({ date: -1 })
    .limit(1)
    .toArray();
  if (d2[0]) {
    const d1 = new Date();
    const ret = (d1.getTime() - d2[0].date.getTime()) / 1000 / 60 / 60;
    return ret;
  }
  return 2;
}
async function firstSettings(guildID: string) {
  await db.collection('settings').insertOne({
    _id: guildID,
    commandChannels: [],
    adminRoles: [],
    joinChannels: [],
    blacklistedUsers: [],
    blacklistedEveryone: [],
    saltKing: false,
    saltRole: false,
    notChannel: false,
    prefix: config.prefix,
    lastConnected: new Date(),
  });
  const ret = await db.collection('settings').findOne({ _id: guildID });
  return ret;
}
async function getSettings(guildID: string) {
  let result = await db.collection('settings').findOne({ _id: guildID });
  if (!result) {
    result = await firstSettings(guildID);
  }
  return result;
}
async function checkGuild(id: string) {
  // create settings
  if (await getSettings(id)) {
    return true;
  }
  return false;
}

// automatic deletion of reports:
async function onHour(bot: Client, isFirst: boolean) {
  const d = new Date();
  const h = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  const e = h.getTime() - d.getTime();
  if (e > 100) {
    // some arbitrary time period
    setTimeout(onHour.bind(null, bot, false), e);
  }
  let msg: Message;
  if (isFirst) {
    const chann = bot.channels.fetch('382233880469438465');
    msg = await ((await chann) as TextChannel).send('0 %');
  }

  const t0 = process.hrtime();
  const nd = new Date();
  nd.setDate(nd.getDate() - 7);
  const guilds = bot.guilds.cache.array();
  let counter = 0;
  let latestTimePassed = 0;
  await asyncForEach(guilds, async (G) => {
    const guildID = G.id;
    const localCounter = ++counter;
    await checkGuild(guildID);
    // update the guild settings entry so that it does NOT get deleted
    await db
      .collection('settings')
      .updateOne({ _id: guildID }, { $set: { lastConnected: d } });

    const ranking = await db
      .collection('saltrank')
      .find({ guild: guildID })
      .toArray();
    await asyncForEach(ranking, async (report) => {
      const removeData = await db.collection('salt').deleteMany({
        date: { $lt: nd },
        guild: guildID,
        salter: report.salter,
      });
      if (removeData.deletedCount && removeData.deletedCount > 0) {
        const slt = report.salt - removeData.deletedCount;
        if (slt <= 0) {
          await db
            .collection('saltrank')
            .deleteOne({ salter: report.salter, guild: guildID });
        } else {
          await db
            .collection('saltrank')
            .updateOne(
              { salter: report.salter, guild: guildID },
              { $set: { salt: slt } },
            );
        }
      }
    });
    // update percentage message
    if (msg) {
      const u = process.hrtime(t0);
      if (u[0] - latestTimePassed > 0 || localCounter === guilds.length) {
        // eslint-disable-next-line prefer-destructuring
        latestTimePassed = u[0]; // add a minimum of 1s delay between message updates
        const percentage = Math.round((localCounter / guilds.length) * 100);
        let uptime = '';
        // mins
        let x = Math.floor(u[0] / 60);
        if (x > 0) {
          uptime += `${x}m : `;
        }
        // secs
        x = u[0] % 60;
        if (x >= 0) {
          uptime += `${x}s`;
        }
        await msg.edit(`${percentage} % with ${uptime} passed`);
      }
    }
  });

  // delete every guild where lastConnected < nd from the DB TODO
  // find all guilds that have not connected for a week
  // or dont have the lastConnected attribute at all
  const guilds2 = await db
    .collection('settings')
    .find({
      $or: [
        { lastConnected: { $lt: nd } },
        { lastConnected: { $exists: false } },
      ],
    })
    .toArray();

  await asyncForEach(guilds2, async (guild) => {
    // ignore salt and saltrank, as they are removed after 7 days anyways
    // eslint-disable-next-line no-underscore-dangle
    const guildID = guild._id;
    // remove all data saved for those guilds
    await db.collection('stillmuted').deleteMany({ guildid: guildID });
    await db.collection('users').deleteMany({ guildID });
    await db.collection('votes').deleteMany({ guildid: guildID });
    await db.collection('settings').deleteOne({ _id: guildID });
  });
}

const reactions = [
  '🇦',
  '🇧',
  '🇨',
  '🇩',
  '🇪',
  '🇫',
  '🇬',
  '🇭',
  '🇮',
  '🇯',
  '🇰',
  '🇱',
  '🇲',
  '🇳',
  '🇴',
  '🇵',
  '🇶',
  '🇷',
  '🇸',
  '🇹',
];
// this should take care of everything that needs to be done when a vote ends
async function endVote(
  vote: {
    messageID: Message['id'];
    channelID: Message['channel']['id'];
    authorID: string;
    options: Array<string>;
    topic: string;
    date: Date;
  },
  bot: Client,
) {
  try {
    const chann = (await bot.channels.fetch(vote.channelID)) as TextChannel;
    if (chann) {
      const msg = await chann.messages.fetch(vote.messageID);
      if (msg) {
        const reacts = msg.reactions;
        let finalReact: Array<{ reaction: number; count: number }> = [];
        reactions.forEach((x, i) => {
          if (i >= vote.options.length) {
            return;
          }
          const react = reacts.resolve(x);
          if (react && react.count) {
            if (!finalReact[0] || finalReact[0].count <= react.count) {
              if (!finalReact[0] || finalReact[0].count < react.count) {
                finalReact = [{ reaction: i, count: react.count }];
              } else {
                finalReact.push({ reaction: i, count: react.count });
              }
            }
          }
        });
        if (finalReact[0]) {
          if (finalReact.length > 1) {
            let str = `**${vote.topic}** ended.\n\nThere was a tie between `;
            if (vote.authorID) {
              str = `**${vote.topic}** by <@${vote.authorID}> ended.\n\nThere was a tie between `;
            }
            finalReact.forEach((react, i) => {
              str += `**${vote.options[react.reaction]}**`;
              if (i < finalReact.length - 2) {
                str += ', ';
              } else if (i === finalReact.length - 2) {
                str += ' and ';
              }
            });
            str += ` with each having ** ${finalReact[0].count - 1} ** votes.`;
            await msg.edit(str);
          } else {
            let str = `**${vote.topic}** ended.\n\nThe result is **${
              vote.options[finalReact[0].reaction]
            }** with **${finalReact[0].count - 1}** votes.`;
            if (vote.authorID) {
              str = `**${vote.topic}** by <@${
                vote.authorID
              }> ended.\n\nThe result is **${
                vote.options[finalReact[0].reaction]
              }** with **${finalReact[0].count - 1}** votes.`;
            }
            await msg.edit(str);
          }
        } else {
          let str = `**${vote.topic}** ended.\n\nCould not compute a result.`;
          if (vote.authorID) {
            str = `**${vote.topic}** by <@${vote.authorID}> ended.\n\nCould not compute a result.`;
          }
          await msg.edit(str);
        }
        await msg.reactions.removeAll();
      }
    }
  } catch (error) {
    console.error(JSON.stringify(error, null, 2));
    // eslint-disable-next-line eqeqeq
    if (error.httpStatus != 404 /*  'DiscordAPIError: Unknown Message' */) {
      throw new Error(error);
    }
  }
}
async function voteCheck(bot: Client) {
  const d = new Date();
  const h = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds() + 10,
    0,
  );
  const e = h.getTime() - d.getTime();
  if (e > 100) {
    // some arbitrary time period
    setTimeout(voteCheck.bind(null, bot), e);
  }
  // do vote stuff
  const nd = new Date();
  const votes = await db
    .collection('votes')
    .find({ date: { $lte: nd } })
    .toArray();
  await asyncForEach(votes, async (vote) => {
    await endVote(vote, bot);
    await db.collection('votes').deleteOne(vote);
  });
  // endof vote stuff
}

async function isInDBL(userID: string) {
  const ret = await db.collection('DBLreminder').find({ _id: userID }).count();
  return ret;
}

async function toggleDBL(userID: string, add: boolean) {
  if (add && !(await isInDBL(userID))) {
    await db.collection('DBLreminder').insertOne({ _id: userID, voted: false });
  } else if (!add) {
    await db.collection('DBLreminder').deleteOne({ _id: userID });
  }
}

async function toggleStillMuted(userID: string, guildID: string, add: boolean) {
  if (
    add
    && !(
      (await db
        .collection('stillMuted')
        .find({ userid: userID, guildid: guildID })
        .count()) > 0
    )
  ) {
    await db
      .collection('stillMuted')
      .insertOne({ userid: userID, guildid: guildID });
  } else if (!add) {
    await db
      .collection('stillMuted')
      .deleteMany({ userid: userID, guildid: guildID });
  }
}
async function getSaltKing(guildID: string) {
  const settings = await getSettings(guildID);
  return settings.saltKing;
}
async function getSaltRole(guildID: string) {
  const set = await getSettings(guildID);
  return set.saltRole;
}
async function setSettings(guildID: string, settings) {
  if (await getSettings(guildID)) {
    await db
      .collection('settings')
      .updateOne({ _id: guildID }, { $set: settings });
  }
  return true;
}
async function setSaltRole(guildID: string, roleID: string) {
  await setSettings(guildID, { saltRole: roleID });
}
async function getNotChannel(guildID: string) {
  const set = await getSettings(guildID);
  return set.notChannel;
}
// top 5 salty people
async function topSalt(guildID: string) {
  const result = await db
    .collection('saltrank')
    .find({ guild: guildID })
    .sort({ salt: -1 })
    .limit(5)
    .toArray();
  if (!result) {
    return [];
  }
  return result;
}
function setSaltKing(guildID: string, userID: string) {
  return setSettings(guildID, { saltKing: userID });
}
async function updateSaltKing(G: Guild) {
  if (G.available && G.me) {
    if (
      G.me.hasPermission('MANAGE_ROLES', {
        checkAdmin: true,
        checkOwner: false,
      })
    ) {
      const SaltKing = await getSaltKing(G.id);
      let SaltRole = await getSaltRole(G.id);
      const groles = await G.roles;
      if (!SaltRole || !groles.cache.has(SaltRole)) {
        if (G.roles.cache.size < 250) {
          await G.roles
            .create({
              data: {
                name: 'SaltKing',
                color: '#FFFFFF',
                position: 0,
                permissions: [],
                mentionable: true,
              },
              reason:
                'SaltKing role needed for Saltranking to work. You can adjust this role if you like.',
            })
            .then(async (role) => {
              await setSaltRole(G.id, role.id);
              SaltRole = role.id;
            });
        } else {
          const channel = await getNotChannel(G.id);
          if (channel) {
            const chan = G.channels.cache.get(channel);
            if (chan) {
              const perms = chan.permissionsFor(G.me);
              if (perms && perms.has('SEND_MESSAGES')) {
                (chan as TextChannel).send(
                  `Hey there ${G.owner}!\nI regret to inform you that this server has 250 roles and I therefore can't add SaltKing. If you want to manage the role yourself delete one and then just change the settings of the role i create automatically.`,
                );
              }
            }
          }
          return;
        }
      }
      const sltID = await topSalt(G.id);
      let saltID: string | undefined;
      if (sltID[0]) {
        saltID = sltID[0].salter;
      }
      const role = await groles.fetch(SaltRole);
      if (role && role.position < G.me.roles.highest.position) {
        if (SaltKing && saltID !== SaltKing) {
          const user = await G.members.fetch(SaltKing).catch(() => {});
          if (user) {
            user.roles.remove(SaltRole, 'Is not as salty anymore');
          }
        }
        if (saltID) {
          const nuser = await G.members.fetch(saltID).catch(() => {});
          if (nuser) {
            if (!nuser.roles.cache.has(SaltRole)) {
              await nuser.roles.add(SaltRole, 'Saltiest user');
            }
          }
          if (saltID !== SaltKing) {
            await setSaltKing(G.id, saltID);
          }
        }
      } else {
        const channel = await getNotChannel(G.id);
        if (channel) {
          const chan = G.channels.cache.get(channel);
          if (chan) {
            const perms = chan.permissionsFor(G.me);
            if (perms && perms.has('SEND_MESSAGES')) {
              (chan as TextChannel).send(
                `Hey there ${G.owner}!\nI regret to inform you that my highest role is beneath <@&${SaltRole}>, which has the effect that i cannot give or take if from users.`,
              );
            }
          }
        }
      }
    } else {
      const channel = await getNotChannel(G.id);
      if (channel) {
        const chan = G.channels.cache.get(channel);
        if (chan) {
          const perms = chan.permissionsFor(G.me);
          if (perms && perms.has('SEND_MESSAGES')) {
            (chan as TextChannel).send(
              `Hey there ${G.owner}!\nI regret to inform you that i have no permission to manage roles and therefore can't manage the SaltKing role.`,
            );
          }
        }
      }
    }
  }
}
function setNotChannel(guildID: string, channelID: String | false) {
  return setSettings(guildID, { notChannel: channelID });
}
async function sendUpdate(update: string, bot: Client) {
  await asyncForEach(bot.guilds.cache.array(), async (G) => {
    if (G.available) {
      const cid = await getNotChannel(G.id);
      if (cid) {
        const channel = G.channels.cache.get(cid) as TextChannel;
        if (channel && G.me) {
          const perms = channel.permissionsFor(G.me);
          if (perms && perms.has('SEND_MESSAGES')) {
            if (G.id === '380669498014957569') {
              channel.send(`<@&460218236185739264> ${update}`);
            } else {
              channel.send(update);
            }
          }
        } else {
          setNotChannel(G.id, false);
        }
      }
    }
  });
}

async function getSalt(userid: string, guildID: string) {
  const result = await db
    .collection('saltrank')
    .findOne({ salter: userid, guild: guildID });
  if (!result) {
    return 0;
  }
  return result.salt;
}

async function saltUp(
  userid1: string,
  userid2: string,
  ad: boolean,
  guildID: string,
) {
  const time = await saltDowntimeDone(userid1, userid2);
  if (time > 1 || ad) {
    return addSalt(userid1, userid2, guildID);
  }
  return time;
}

async function usageUp(userid: string, guildID: string) {
  const user = await getuser(userid, guildID);
  const updateval = user.botusage + 1;
  updateUser(userid, { $set: { botusage: updateval } }, guildID);
}

async function checks(userid: string, guildID: string) {
  // maybe add more checks
  if (await getuser(userid, guildID)) {
    return true;
  }
  // else
  return false;
}
function setPrefix(guildID: string, pref?: string) {
  return setSettings(guildID, { prefix: pref });
}
async function getPrefix(guildID: string) {
  let settings = await getSettings(guildID);
  settings = settings.prefix;
  if (!settings) {
    await setPrefix(guildID, config.prefix);
    return config.prefix;
  }
  return settings;
}

async function getAdminRole(guildID: string) {
  const settings = await getSettings(guildID);
  return settings.adminRoles as Array<string>;
}

async function setAdminRole(guildID: string, roleID: string, insert: boolean) {
  const roles = await getAdminRole(guildID);
  if (insert) {
    if (!roles.includes(roleID)) {
      roles.push(roleID);
    }
  } else {
    const index = roles.indexOf(roleID);
    if (index > -1) {
      roles.splice(index, 1);
    }
  }
  const settings = { adminRoles: roles };
  return setSettings(guildID, settings);
}

async function getCommandChannel(guildID: string) {
  const settings = await getSettings(guildID);
  return settings.commandChannels;
}

async function setCommandChannel(
  guildID: string,
  cid: string,
  insert: boolean,
) {
  const channels = await getCommandChannel(guildID);
  if (insert) {
    if (!channels.includes(cid)) {
      channels.push(cid);
    }
  } else {
    const index = channels.indexOf(cid);
    if (index > -1) {
      channels.splice(index, 1);
    }
  }
  const settings = { commandChannels: channels };
  return setSettings(guildID, settings);
}

async function getJoinChannel(guildID: string) {
  const settings = await getSettings(guildID);
  return settings.joinChannels;
}

async function setJoinChannel(guildID: string, cid: string, insert: boolean) {
  const channels = await getJoinChannel(guildID);
  if (insert) {
    if (!channels.includes(cid)) {
      channels.push(cid);
    }
  } else {
    const index = channels.indexOf(cid);
    if (index > -1) {
      channels.splice(index, 1);
    }
  }
  const settings = { joinChannels: channels };
  return setSettings(guildID, settings);
}

async function getBlacklistedUser(guildID: string) {
  const settings = await getSettings(guildID);
  return settings.blacklistedUsers;
}

async function isBlacklistedUser(userid: string, guildID: string) {
  const users = await getBlacklistedUser(guildID);
  return users.includes(userid);
}

async function setBlacklistedUser(
  userid: string,
  guildID: string,
  insert: boolean,
) {
  const users = await getBlacklistedUser(guildID);
  if (insert) {
    if (!users.includes(userid)) {
      users.push(userid);
    }
  } else {
    const index = users.indexOf(userid);
    if (index > -1) {
      users.splice(index, 1);
    }
  }
  const settings = { blacklistedUsers: users };
  return setSettings(guildID, settings);
}
/* eslint-disable */
// TODO some time later , blacklist @everyone in these channels
async function getBlacklistedEveryone(guildID: string) {
  const settings = await getSettings(guildID);
  return settings.blacklistedEveryone;
}

async function setBlacklistedEveryone(
  guildID: string,
  cid: string,
  insert: boolean
) {}
/* eslint-enable */

async function joinsound(
  userid: string,
  surl: string | false,
  guildID: string,
) {
  if (await checks(userid, guildID)) {
    const update = { $set: { sound: surl } };
    await db.collection('users').updateOne({ userID: userid, guildID }, update);
  }
  return true;
}

export default {
  async startup(bot: Client) {
    // create Collection
    if (!db.collection('settings')) {
      await db.createCollection('settings').then(() => {});
    }
    // Dataset of salt
    if (!db.collection('salt')) {
      db.createCollection('salt', (err) => {
        if (err) throw err;
      });
    }
    if (!db.collection('saltrank')) {
      db.createCollection('saltrank', (err) => {
        if (err) throw err;
      });
    }
    if (!db.collection('users')) {
      db.createCollection('users', (err) => {
        if (err) throw err;
      });
    }
    if (!db.collection('votes')) {
      db.createCollection('votes', (err) => {
        if (err) throw err;
      });
    }
    // repeating functions:
    onHour(bot, true);
    voteCheck(bot);
  },
  async getUser(userid: string, guildID: string) {
    const result = await getuser(userid, guildID);
    return result;
  },
  usageUp(userid: string, guildID: string) {
    usageUp(userid, guildID);
  },
  async saltUp(userid1: string, userid2: string, G: Guild) {
    const ret = await saltUp(userid1, userid2, false, G.id);
    updateSaltKing(G);
    return ret;
  },
  async saltUpAdmin(userid1: string, userid2: string, G: Guild) {
    const ret = await saltUp(userid1, userid2, true, G.id);
    updateSaltKing(G);
    return ret;
  },
  getSalt(userid: string, guildID: string) {
    return getSalt(userid, guildID);
  },
  async getUsage(userid: string, guildID: string) {
    const user = await getuser(userid, guildID);
    return parseInt(user.botusage, 10);
  },
  async remOldestSalt(userid: string, G: Guild) {
    const guildID = G.id;
    const id = await db
      .collection('salt')
      .find({ salter: userid, guild: guildID })
      .sort({ date: 1 })
      .limit(1)
      .toArray();
    if (id[0]) {
      // eslint-disable-next-line no-underscore-dangle
      await db.collection('salt').deleteOne({ _id: id[0]._id });
      saltGuild(userid, guildID, -1);
      updateSaltKing(G);
      return true;
    }
    return false;
  },
  async addGuild(guildID: string) {
    await checkGuild(guildID);
  },
  topSalt(guildID: string) {
    return topSalt(guildID);
  },
  async joinable(guildID: string, cid: string) {
    const channels = await getJoinChannel(guildID);
    return channels.includes(cid);
  },
  async isAdmin(guildID: string, user: GuildMember) {
    // checks for admin and Owner, they can always use
    if (
      user.hasPermission('ADMINISTRATOR', {
        checkAdmin: true,
        checkOwner: true,
      })
    ) {
      return true;
    }
    // Owner is always admin hehe
    if (user.id === OWNERID) {
      return true;
    }
    const roles = await getAdminRole(guildID);
    let ret = false;
    roles.forEach((role) => {
      if (user.roles.cache.has(role)) {
        ret = true;
      }
    });
    return ret;
  },
  isAdminRole: async (guildID: string, adminRole: string) => {
    const roles = await getAdminRole(guildID);
    let ret = false;
    roles.forEach((role) => {
      if (adminRole === role) {
        ret = true;
      }
    });
    return ret;
  },
  async commandAllowed(guildID: string, cid: string) {
    const channels = await getCommandChannel(guildID);
    return channels.length === 0 || channels.includes(cid);
  },
  async isCommandChannel(guildID: string, cid: string) {
    const channels = await getCommandChannel(guildID);
    return channels.includes(cid);
  },
  async commandChannel(guildID: string) {
    const channels = await getCommandChannel(guildID);
    let out = '';
    channels.forEach((channel: string) => {
      out += ` <#${channel}>`;
    });
    return out;
  },
  async getSound(userid: string, guildID: string) {
    const user = await getuser(userid, guildID);
    return user.sound;
  },
  addSound(userid: string, surl: string | false, guildID: string) {
    return joinsound(userid, surl, guildID);
  },
  async isBlacklistedUser(userID: string, guildID: string) {
    if (await checks(userID, guildID)) {
      return isBlacklistedUser(userID, guildID);
    }
    return false;
  },
  setJoinable(guildID: string, channelID: string, insert: boolean) {
    return setJoinChannel(guildID, channelID, insert);
  },
  isJoinable: async (guildID: string, channelID: string) => {
    const channels = await getJoinChannel(guildID);
    return channels.includes(channelID);
  },
  setCommandChannel(guildID: string, channelID: string, insert: boolean) {
    return setCommandChannel(guildID, channelID, insert);
  },
  setAdmin(guildID: string, roleID: string, insert: boolean) {
    return setAdminRole(guildID, roleID, insert);
  },
  async setBlacklistedUser(guildID: string, userID: string, insert: boolean) {
    if (await checks(userID, guildID)) {
      return setBlacklistedUser(userID, guildID, insert);
    }
    return false;
  },
  getSettings(guildID: string) {
    return getSettings(guildID);
  },
  async clrSalt(userid: string, G: Guild) {
    const guildID = G.id;
    await db.collection('salt').deleteMany({ guild: guildID, salter: userid });
    await saltGuild(userid, guildID, 1, true);
    await updateSaltKing(G);
  },
  async resetSalt(G: Guild) {
    const guildID = G.id;
    await db.collection('saltrank').deleteMany({ guild: guildID });
    await db.collection('salt').deleteMany({ guild: guildID });
    await updateSaltKing(G);
  },
  async setNotification(guildID: string, cid: string | false) {
    await setNotChannel(guildID, cid);
  },
  isNotChannel: async (guildID: string, channID: string) => {
    const notChann = await getNotChannel(guildID);
    return channID === notChann;
  },
  sendUpdate(update: string, bot: Client) {
    sendUpdate(update, bot);
  },
  getPrefixE(guildID: string) {
    return getPrefix(guildID);
  },
  async setPrefixE(guildID: string, pref: string) {
    await setPrefix(guildID, pref);
    PREFIXES[guildID] = pref;
    return pref;
  },
  async getPrefixesE(bot: Client) {
    resetPrefixes();
    const guilds = bot.guilds.cache.array();
    asyncForEach(guilds, async (G) => {
      PREFIXES[G.id] = await getPrefix(G.id);
    });
  },
  toggleDBLE(userID: string, add: boolean) {
    toggleDBL(userID, add);
  },
  getDBLE(userID: string) {
    return isInDBL(userID);
  },
  addVote(vote) {
    return db.collection('votes').insertOne(vote);
  },
  toggleStillMuted(userID: string, guildID: string, add: boolean) {
    return toggleStillMuted(userID, guildID, add);
  },
  async isStillMuted(userID: string, guildID: string) {
    const find = await db
      .collection('stillMuted')
      .findOne({ userid: userID, guildid: guildID });
    return find;
  },
  async getDBLSubs() {
    const users = await db.collection('DBLreminder').find().toArray();
    return users;
  },
};
