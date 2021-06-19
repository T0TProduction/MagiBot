﻿import { TextChannel } from 'discord.js';
// eslint-disable-next-line import/no-cycle
import { bot } from '../bot';
import { PREFIXES } from '../shared_assets';
import { commandCategories } from '../types/enums';
import { magibotCommand } from '../types/magibot';
import { sendBugreport } from '../webhooks';

export const bug: magibotCommand = {
	name: 'bug',
	async main(content, msg) {
		if (!(content.length > 0)) {
			msg.reply(
				`you need to add info about the report after the command. Use \`${PREFIXES.get(
          msg.guild!.id,
				)}.help bug\` to get more info.`,
			);
			return;
		}
		msg.channel
			.send(`Do you want to send this bugreport?\n${content}`)
			.then((mess) => {
				const filter = (reaction, user) => (reaction.emoji.name === '☑' || reaction.emoji.name === '❌')
          && user.id === msg.author.id;
				mess.react('☑');
				mess.react('❌');
				mess
					.awaitReactions(filter, {
						max: 1,
						time: 20000,
					})
					.then(async (reacts) => {
						mess.delete();
						const frst = reacts.first();
						if (frst && frst.emoji.name === '☑') {
							sendBugreport(
								`**Bugreport** by ${msg.author.username} (<@${
									msg.author.id
								}>) on server ${msg.guild!.name}( ${
                  msg.guild!.id
								} ) :\n${content}`,
							).then(() => {
								msg.channel.send('Succesfully sent bugreport.');
							});
						} else if (reacts.first()) {
							msg.channel.send('Successfully canceled bugreport.');
						}
					});
			});
	},
	admin: false,
	ehelp() {
		return [
			{
				name: '<bugreport with information about what you did, what was expected, and what went wrong>',
				value: 'Report a bug concerning MagiBot',
			},
		];
	},
	perm: 'SEND_MESSAGES',
	hide: false,
	dev: false,
	category: commandCategories.misc,
};
