import { GuildMember } from 'discord.js';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import Path from 'path';
import { get } from 'node:https';
import fastFolderSize from 'fast-folder-size';

const basePath = Path.join(__dirname, '../../../joinsounds');

export async function setupLocalFolders() {
	await mkdir(basePath).catch((error) => {
		// If the error is that it already exists, that's fine
		if (error.code !== 'EEXIST') {
			throw error;
		}
	});
}

async function downloadFile(url: string, path: string) {
	get(url, (res) => {
		const writeStream = createWriteStream(path);
		res.pipe(writeStream);
		writeStream.on('finish', () => {
			writeStream.close();
		});
	});
}

function getFolderSize(path: string): Promise<number> {
	return new Promise((resolve, reject) => {
		fastFolderSize(path, (err, bytes) => {
			if (err) {
				reject(err);
			}
			resolve(bytes !== undefined ? bytes : 9999999);
		});
	});
}

const oneMegabyte = 1024 * 1024;

async function checkIfUserHasEnoughSpace(member: GuildMember) {
	const path = Path.join(basePath, member.id);
	await mkdir(path).catch((error) => {
		// If the error is that it already exists, that's fine
		if (error.code !== 'EEXIST') {
			throw error;
		}
	});
	const sizeOfFolder = await getFolderSize(path);
	console.log('sizeOfFolder', sizeOfFolder);
	return sizeOfFolder <= oneMegabyte;
}

export async function saveJoinsoundOfUser(
	member: GuildMember,
	fileUrl: string,
) {
	console.log('downloading file....');
	if (!(await checkIfUserHasEnoughSpace(member))) {
		console.log('folder too large already!');
		return false;
	}
	const filename = Path.join(basePath, member.id, `${member.guild.id}.audio`);
	await downloadFile(fileUrl, filename);
	return true;
}
