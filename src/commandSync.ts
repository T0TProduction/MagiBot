import { REST } from '@discordjs/rest';
import {
	RESTPostAPIApplicationCommandsJSONBody,
	Routes,
} from 'discord-api-types/v9';
import { ping } from './commands/ping';
import { roll } from './commands/roll';
import { invite } from './commands/invite';
import { APP_ID, TOKEN } from './shared_assets';

const commands = [ping.slashCommand!.definition, roll.slashCommand!.definition];
const testCommands: Array<RESTPostAPIApplicationCommandsJSONBody> = [
  invite.slashCommand!.definition,
	// roll.slashCommand!.definition
];

const rest = new REST({ version: '9' }).setToken(TOKEN);

const teabotsGuildId = '380669498014957569';

export async function syncCommands() {
	try {
		console.log('Started refreshing application (/) commands.');
		await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
		// for quick updates during testing:
		await rest.put(Routes.applicationGuildCommands(APP_ID, teabotsGuildId), {
			body: testCommands,
		});
		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
}
