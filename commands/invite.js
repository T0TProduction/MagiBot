module.exports = {
    main: async function (bot, msg) {
        //TODO check if invite activated on server
        //TODO let user define invite length
        let invite = await msg.channel.createInvite({}, "member used invite command");
        msg.channel.send("Here's an invite link to this channel: " + invite);
    },
    help: "create an invite link to the server",
    perm: ["SEND_MESSAGES", "CREATE_INSTANT_INVITE"],
    admin: false
};
