import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import {
	MagibotAdminSlashCommand,
	MagibotSlashCommand,
} from '../../types/command';
import { commandCategories } from '../../types/enums';
import { salt } from './salt';

// TODO make this only available to admins!
const adminApplicationCommandBase = new SlashCommandBuilder()
	.setName('admin')
	.setDescription('Admin only commands.');

const adminApplicationCommands: { [k: string]: MagibotAdminSlashCommand } = {
	salt,
};

Object.values(adminApplicationCommands).forEach((command) => {
	command.registerSlashCommand(adminApplicationCommandBase);
});

async function runCommand(interaction: CommandInteraction) {
	const subcommandGroup = interaction.options.getSubcommandGroup(true);
	const command = adminApplicationCommands[subcommandGroup];
	if (command) {
		// we assume the command exists, but just in case
		command.run(interaction);
	}
}
export const admin: MagibotSlashCommand = {
	help() {
		// TODO compile from help of all admin commands?
		return [];
	},
	permissions: 'SEND_MESSAGES',
	category: commandCategories.admin,
	run: runCommand,
	definition: adminApplicationCommandBase.toJSON(),
};
