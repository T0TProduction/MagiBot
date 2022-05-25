import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, unlink, stat } from 'node:fs/promises';
import Path from 'path';
import { get } from 'node:https';
import fastFolderSize from 'fast-folder-size';

const basePath = Path.join(__dirname, '../../../joinsounds');

type JoinsoundTarget =
  | { userId: string; guildId: string; default?: undefined }
  | { userId: string; guildId?: undefined; default: true }
  | { userId?: undefined; guildId: string; default: true };

// eslint-disable-next-line no-shadow
export const enum JoinsoundStoreError {
  noStorageLeftOnServer = 0x1000,
  noStorageLeftForUser = 0x1001,
}

async function setupLocalFolders() {
	await mkdir(basePath).catch((error) => {
		// If the error is that it already exists, that's fine
		if (error.code !== 'EEXIST') {
			throw error;
		}
	});
}
setupLocalFolders();

async function downloadFile(url: string, path: string) {
	return new Promise<void>((resolve /* , reject */) => {
		get(url, (res) => {
			const writeStream = createWriteStream(path);
			res.pipe(writeStream);
			writeStream.on('finish', () => {
				writeStream.close();
				resolve();
			});
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
const fourtyGigabyte = 40 * 1024 * oneMegabyte;

async function doesServerHaveEnoughSpace() {
	const sizeOfFolder = await getFolderSize(basePath);
	return sizeOfFolder <= fourtyGigabyte;
}

function getTargetPath(target: JoinsoundTarget) {
	return Path.join(
		basePath,
		target.userId ? `user_${target.userId}` : `guild_${target.guildId}`,
	);
}

async function doesUserHaveEnoughSpace(target: JoinsoundTarget, targetFileName : string) {
	const path = getTargetPath(target);
	await mkdir(path).catch((error) => {
		// If the error is that it already exists, that's fine
		if (error.code !== 'EEXIST') {
			throw error;
		}
	});
	const sizeOfFolder = await getFolderSize(path);
	const statsOfExistingFile = await stat(targetFileName).catch((error) => {
		// If the error is that it doesn't exists, that's fine
		if (error.code !== 'ENOENT') {
			throw error;
		}
	});
	const sizeOfExistingFile = statsOfExistingFile?.size || 0;
	return (sizeOfFolder - sizeOfExistingFile) <= oneMegabyte;
}

function getFilename(target: JoinsoundTarget) {
	const title = target.default ? 'default' : `guild_${target.guildId}`;
	return Path.join(getTargetPath(target), title);
}

export async function storeJoinsoundOfTarget(
	target: JoinsoundTarget,
	fileUrl: string,
) {
	if (!(await doesServerHaveEnoughSpace())) {
		// this should not happen. but if it does, we handle it to stop the server from being overloaded
		return JoinsoundStoreError.noStorageLeftOnServer;
	}
	const filename = getFilename(target);
	if (!(await doesUserHaveEnoughSpace(target, filename))) {
		return JoinsoundStoreError.noStorageLeftForUser;
	}
	await downloadFile(fileUrl, filename);
	return null;
}

export async function removeLocallyStoredJoinsoundOfTarget(
	target: JoinsoundTarget,
) {
	const filename = getFilename(target);
	await unlink(filename).catch((error) => {
		// If the error is that it doesn't exists, that's fine
		if (error.code !== 'ENOENT') {
			throw error;
		}
	});
}

export function getJoinsoundReadableStreamOfUser(target: JoinsoundTarget) {
	return createReadStream(getFilename(target));
}
