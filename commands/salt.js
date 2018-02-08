var data = require(__dirname + '/../db.js');

function printHelp(msg, bot) {
    var info = [];

    info.push({
        name: "add @User",
        value: "Reporte einen Nutzer fürs salten!",
        inline: true
    });

    let embed = {
        color: bot.COLOR,
        description: "Nutzbare Befehle in der Rubrik salt:",
        fields: info,
        footer: {
            icon_url: bot.user.avatarURL,
            text: bot.user.username
        }
    }

    msg.channel.send('', { embed });
}

module.exports = {
    main: async function f(bot, msg) {
        const args = msg.content.split(/ +/);
        var command = args[0].toLowerCase();
        if (command == "help") {
            printHelp(msg, bot);
        } else {
            if (msg.guild) {
                switch (command) {
                    case 'add':
                        var mention = args[1];
                        if (mention.startsWith('<@') && mention.endsWith('>')) {
                            mention = mention.substr(2).slice(0, -1);
                            if (mention.startsWith('!')) {
                                mention = mention.substr(1);
                            }
                            if (mention == bot.user.id) {
                                msg.reply("du kannst mich nicht für salt reporten!");
                                return;
                            }
                            if (mention == msg.author.id) {
                                msg.reply("du kannst dich nicht für salt reporten!");
                                return;
                            }
                            let time = await data.saltUp(mention, msg.author.id, msg.guild.id);
                            console.log(time);
                            if (time == 0) {
                                msg.channel.send("Erfolgreich <@!" + mention + "> für salt reportet!");
                            } else {
                                msg.channel.send("Du kannst <@!" + mention + "> erst in " + (59 - Math.floor((time * 60) % 60)) + " min und " + (60 - Math.floor((time * 60 * 60) % 60)) + " sek wieder für salt reporten!");
                            }
                        } else {
                            msg.channel.send("Du musst schon einen Nutzer angeben, den du reporten willst!");
                        }
                        break;
                    case "top": var salters = await data.topSalt(msg.guild.id);
                        var info = [];
                        for (var i = 0; i < 5; i++) {
                            if (salters[i]) {
                                let member = await msg.guild.fetchMember(salters[i].salter);
                                info.push({
                                    name: (i + 1) + ". Platz: " + member.displayName,
                                    value: salters[i].salt + " Salz",
                                    inline: false
                                });
                            } else { break; }
                        }
                        let embed = {
                            color: 0xffffff,
                            description: "Top 5 Salter des " + msg.guild.name + ":",
                            fields: info,
                            footer: {
                                icon_url: await msg.guild.iconURL,
                                text: await msg.guild.name
                            }
                        }
                        msg.channel.send('', { embed });
                        break;
                    default:
                        msg.reply('Dies ist kein gültiger Befehl. Nutze k!salt help für mehr Information.');
                        break;
                }
            } else {
                msg.reply("Befehle ausser help sind nur auf Servern verfügbar.");
            }
        }
    },
    help: 'Salz Befehle. Nutze k!salt help für mehr Information',
    admin: false,
    hide: false
};
