import dotenv from 'dotenv';

dotenv.config(); // load .env into environment

const token = process.env.TOKEN;
const appId = process.env.APP_ID;
const owner = process.env.OWNERID;
const prefix = process.env.PREFIX;
const dburl = process.env.DATABASE_URL;
let blapis: {
	[listname: string]: string;
};

try {
	// eslint-disable-next-line import/no-dynamic-require, global-require
	blapis = require(`${__dirname}/../botlistTokens.json`);
} catch (e) {
	// eslint-disable-next-line no-console
	console.warn('no bot list tokens found, defaulting to none');
	blapis = {};
}

if (!(token && owner && prefix && dburl && appId)) {
	throw new Error('Missing .env configuration!');
}

export default {
	tk: token,
	owner,
	prefix,
	dburl,
	blapis,
	appId,
};
