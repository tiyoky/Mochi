const Discord = require('discord.js');
const client = new Discord.Client({ 
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_PRESENCES,
        Discord.Intents.FLAGS.DIRECT_MESSAGES,
        Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS
    ]
});

const { prefix, ownerID } = require('./config.json');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');

// Map pour stocker les informations de connexion audio par serveur
const audioConnections = new Map();

client.once('ready', () => {
    console.log(`${client.user.tag} est maintenant en ligne!`);
});

client.on('guildCreate', async guild => {
    const owner = await client.users.fetch(guild.ownerId);
    try {
        const invite = await guild.channels.cache.first().createInvite({ maxAge: 0 });
        owner.send(`Le bot ${client.user.tag} a rejoint le serveur "${guild.name}".\nPropriétaire : ${owner.tag}\nNombre de membres : ${guild.memberCount}\nInvitation du serveur : ${invite}`);
    } catch (error) {
        console.error('Erreur lors de la création de l\'invitation:', error);
    }
});

client.on('guildDelete', guild => {
    const owner = client.users.cache.get(guild.ownerId);
    owner.send(`Le bot ${client.user.tag} a quitté le serveur ${guild.name}.`);
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'create') {
        // Vérifie que l'utilisateur a envoyé un emoji
        if (!args.length || !args[0].match(/<:[a-zA-Z0-9]+:[0-9]+>/)) {
            return message.channel.send("Merci de spécifier un emoji valide.");
        }

        const emojiName = args[0].split(':')[1];
        const emojiId = args[0].split(':')[2].slice(0, -1);
        
        // Crée l'emoji dans le serveur
        message.guild.emojis.create(`https://cdn.discordapp.com/emojis/${emojiId}.png`, emojiName)
            .then(emoji => message.channel.send(`Emoji ${emoji} créé avec succès!`))
            .catch(error => {
                console.error('Erreur lors de la création de l\'emoji:', error);
                message.channel.send("Une erreur s'est produite lors de la création de l'emoji.");
            });

    } else if (command === 'cat') {
        try {
            const response = await fetch('https://api.thecatapi.com/v1/images/search');
            if (!response.ok) throw new Error('Failed to fetch cat image');
            const data = await response.json();
            const imageUrl = data[0].url;
            const embed = new Discord.MessageEmbed()
                .setTitle('Random Cat')
                .setImage(imageUrl)
                .setColor('#0099ff');
            message.channel.send(embed);
        } catch (error) {
            console.error('Error fetching cat image:', error);
            message.channel.send("An error occurred while fetching the cat image.");
        }
    } else if (command === 'dog') {
        try {
            const response = await fetch('https://dog.ceo/api/breeds/image/random');
            if (!response.ok) throw new Error('Failed to fetch dog image');
            const data = await response.json();
            const imageUrl = data.message;
            const embed = new Discord.MessageEmbed()
                .setTitle('Random Dog')
                .setImage(imageUrl)
                .setColor('#0099ff');
            message.channel.send(embed);
        } catch (error) {
            console.error('Error fetching dog image:', error);
            message.channel.send("An error occurred while fetching the dog image.");
        }

    } else if (command === 'kissorkill') {
        if (!message.member.hasPermission('MANAGE_GUILD')) {
            return message.channel.send("Vous n'avez pas la permission de gérer le serveur.");
        }

        // Récupérer une image d'anime aléatoire depuis l'API
        fetch('https://api.waifu.pics/sfw/kiss')
            .then(response => response.json())
            .then(data => {
                const animeImageUrl = data.url;

                // Envoyer l'image dans le salon
                const embed = new Discord.MessageEmbed()
                    .setTitle('Kiss or Kill ?')
                    .setImage(animeImageUrl)
                    .setColor('#0099ff')
                    .setDescription('Réagissez avec 🔪 pour "Kill" ou 💋 pour "Kiss".');

                message.channel.send(embed)
                    .then(sentMessage => {
                        sentMessage.react('🔪')
                            .then(() => sentMessage.react('💋'))
                            .catch(err => console.error('Error reacting:', err));
                    })
                    .catch(err => console.error('Error sending message:', err));
            })
            .catch(error => {
                console.error('Error fetching anime image:', error);
                message.channel.send("Une erreur s'est produite lors de la récupération de l'image d'anime.");
            });
        

    } else if (command === 'giveaway') {
        if (args.length !== 3) {
            return message.channel.send("Syntaxe incorrecte. Utilisation : `giveaway <prix> <nombre gagnant> <temp>`");
        }

        const prize = args[0];
        const winnersCount = parseInt(args[1]);
        const duration = parseDuration(args[2]);

        if (!winnersCount || winnersCount <= 0) {
            return message.channel.send("Le nombre de gagnants doit être un nombre positif supérieur à zéro.");
        }

        if (!duration || duration <= 0) {
            return message.channel.send("La durée doit être spécifiée en minutes et être un nombre positif supérieur à zéro.");
        }

        const endTime = Date.now() + duration * 60 * 1000;

        const embed = new Discord.MessageEmbed()
            .setTitle(`🎉 Giveaway: ${prize} 🎉`)
            .setDescription(`Réagissez avec ⭐️ pour participer !\nNombre de gagnants : ${winnersCount}\nDurée : ${duration} minutes`)
            .setColor('#FFD700')
            .setFooter(`Temps restant : ${formatTime(duration * 60)}`);

        const sentMessage = await message.channel.send(embed);
        sentMessage.react('⭐️');

        const filter = (reaction, user) => reaction.emoji.name === '⭐️' && !user.bot;
        const collector = sentMessage.createReactionCollector(filter, { time: duration * 60 * 1000 });

        collector.on('end', async collected => {
            const participants = collected.get('⭐️').users.cache.filter(user => !user.bot).map(user => user.id);
            if (participants.length > 0) {
                const winners = [];
                for (let i = 0; i < winnersCount; i++) {
                    const winnerIndex = Math.floor(Math.random() * participants.length);
                    winners.push(client.users.cache.get(participants[winnerIndex]).toString());
                    participants.splice(winnerIndex, 1);
                }
                message.channel.send(`🎉 Les gagnants du giveaway ${prize} sont : ${winners.join(', ')} ! 🎉`);
            } else {
                message.channel.send(`❌ Aucun participant n'a réagi au giveaway "${prize}". ❌`);
            }
        });
    } else if (command === 'help') {
        const embed1 = new Discord.MessageEmbed()
            .setTitle('modération')
            .setDescription(`Commandes de modération`)
            .addField(`${prefix}ban <@utilisateur>`, 'Bannit l\'utilisateur mentionné.')
            .addField(`${prefix}mute <@utilisateur> <durée>`, 'Mute l\'utilisateur pour une durée spécifiée.')
            .addField(`${prefix}kick <@utilisateur>`, 'Kick l\'utilisateur mentionné.')
            .setColor('#00FF00');
        
        const embed2 = new Discord.MessageEmbed()
            .setTitle('gestion')
            .setDescription(`Autres commandes`)
            .addField(`${prefix}create <nom> <emoji>`, 'créer L emojie choisi dans le message')
            .addField(`${prefix}giveaway <prix> <nombre gagnant> <temp> `, 'lance un giveaway')
            .addField(`${prefix}setticket`, 'Crée un ticket pour contacter le staff ou réclamer une récompense.')
            .addField(`${prefix}close`, 'Ferme le ticket actuel.')
            .setColor('#00FF00');

        const embed3 = new Discord.MessageEmbed()
            .setTitle('Fun')
            .setDescription(`Fun commands`)
            .addField(`${prefix}cat`, 'Affiche une image aléatoire de chat.')
            .addField(`${prefix}dog`, 'Affiche une image aléatoire de chien.')
            .addField(`${prefix}play <lien youtube>`, 'fais jouer de la musique dans la voc que vous êtes.')
            .addField(`${prefix}stop `, 'fais quitter le bot dans la voc que vous etes et enleve la musique.')
            .addField(`${prefix}kissorkill`, 'pour le salon kiss or kill')
            .setColor('#0099ff');

        const embed4 = new Discord.MessageEmbed()
            .setTitle('owner👑')
            .setDescription(`seulement lowner peut faire les commandes`)
            .addField(`rien pour le moment `, '.')
            .addField(`rien pour le momemt`, '.')
            .setColor('#0099ff');

        message.channel.send(embed1).then(embedMessage => {
            const navigationReactions = ['⬅️', '➡️'];
            navigationReactions.forEach(async reaction => await embedMessage.react(reaction));

            const filter = (reaction, user) => {
                return navigationReactions.includes(reaction.emoji.name) && user.id === message.author.id;
            };
            
            const collector = embedMessage.createReactionCollector(filter, { time: 60000 });

            collector.on('collect', async (reaction, user) => {
                switch (reaction.emoji.name) {
                    case '➡️':
                        await embedMessage.edit(embed2);
                        break;
                    case '⬅️':
                        await embedMessage.edit(embed1);
                        break;
                }
            });

            collector.on('end', async () => {
                await embedMessage.reactions.removeAll();
            });
        }).catch(console.error);

        message.channel.send(embed3); 
        message.channel.send(embed4); 

    } else if (command === 'unban') {
        // Vérifie que l'utilisateur a la permission de débannir des membres
        if (!message.member.hasPermission('BAN_MEMBERS')) {
            return message.channel.send("Vous n'avez pas la permission de débannir des membres.");
        }

        // Vérifie que l'argument est un ID d'utilisateur valide
        const userId = args[0];
        if (!userId) {
            return message.channel.send("Merci de spécifier l'ID de l'utilisateur à débannir.");
        }

        // Débannit l'utilisateur
        message.guild.fetchBans()
            .then(bans => {
                if (bans.size === 0) {
                    return message.channel.send("Aucun utilisateur n'est banni sur ce serveur.");
                }

                const bannedUser = bans.find(ban => ban.user.id === userId);
                if (!bannedUser) {
                    return message.channel.send("Cet utilisateur n'est pas banni sur ce serveur.");
                }

                message.guild.members.unban(bannedUser.user)
                    .then(() => {
                        message.channel.send(`L'utilisateur avec l'ID ${userId} a été débanni avec succès.`);
                    })
                    .catch(error => {
                        console.error('Erreur lors du débannissement:', error);
                        message.channel.send("Une erreur s'est produite lors du débannissement de l'utilisateur.");
                    });
            })
            .catch(error => {
                console.error('Erreur lors de la récupération des bannissements:', error);
                message.channel.send("Une erreur s'est produite lors de la récupération des bannissements.");
            });


    } else if (command === 'kick') {
        // Vérifie que l'utilisateur a la permission de kicker des membres
        if (!message.member.hasPermission('KICK_MEMBERS')) {
            return message.channel.send("Vous n'avez pas la permission de kicker des membres.");
        }

        // Vérifie si l'utilisateur mentionne un membre à kicker
        const user = message.mentions.users.first();
        if (!user) {
            return message.channel.send("Merci de mentionner l'utilisateur à kick.");
        }

        const member = message.guild.member(user);
        if (!member) {
            return message.channel.send("Cet utilisateur n'est pas sur le serveur.");
        }

        // Kicke le membre
        member.kick('Raison optionnelle').then(() => {
            message.reply(`${user.tag} a été kické avec succès.`);
        }).catch(err => {
            console.error('Erreur lors du kick:', err);
            message.channel.send("Une erreur s'est produite lors du kick de l'utilisateur.");
        });


    } else if (command === 'ban') {
        // Vérifie que l'utilisateur a la permission de bannir des membres
        if (!message.member.hasPermission('BAN_MEMBERS')) {
            return message.channel.send("Vous n'avez pas la permission de bannir des membres.");
        }

        const user = message.mentions.users.first();
        if (user) {
            const member = message.guild.member(user);
            if (member) {
                member.ban({ reason: 'Raison optionnelle' })
                    .then(() => {
                        message.reply(`${user.tag} a été banni avec succès.`);
                    })
                    .catch(error => {
                        console.error('Erreur lors du bannissement:', error);
                        message.channel.send("Une erreur s'est produite lors du bannissement de l'utilisateur.");
                    });
            } else {
                message.channel.send("Cet utilisateur n'est pas sur le serveur.");
            }
        } else {
            message.channel.send("Merci de mentionner l'utilisateur à bannir.");
        }
        
    } else if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.channel.send("Vous devez être dans un salon vocal pour utiliser cette commande.");
        }

        const connection = await voiceChannel.join();
        audioConnections.set(message.guild.id, connection);

        const url = args[0];
        if (!url) {
            return message.channel.send("Merci de spécifier un lien YouTube.");
        }

        try {
            const stream = ytdl(url, { filter: 'audioonly' });
            const dispatcher = connection.play(stream);

            dispatcher.on('finish', () => {
                voiceChannel.leave();
                audioConnections.delete(message.guild.id);
            });

            message.channel.send(`Musique en cours de lecture depuis ${url}`);
        } catch (error) {
            console.error('Erreur lors de la lecture de la musique:', error);
            message.channel.send("Une erreur s'est produite lors de la lecture de la musique.");
        }
    } else if (command === 'stop') {
        const voiceConnection = audioConnections.get(message.guild.id);
        if (voiceConnection) {
            voiceConnection.disconnect();
            audioConnections.delete(message.guild.id);
            message.channel.send("Musique arrêtée et bot déconnecté du canal vocal.");
        } else {
            message.channel.send("Je ne suis pas connecté à un salon vocal.");
        }
    } else if (command === 'setticket') {
        // Créer un embed pour le ticket
        const embed = new Discord.MessageEmbed()
            .setTitle('🌴 • (server) support')
            .setDescription('Cliquez sur le bouton en dessous pour créer un ticket, pour contacter le staff ou réclamer une récompense.');

        // Créer un salon pour le ticket
        message.guild.channels.create(`${message.author.username}-ticket`, {
            type: 'text',
            permissionOverwrites: [
                {
                    id: message.guild.id,
                    deny: ['VIEW_CHANNEL']
                },
                {
                    id: message.author.id,
                    allow: ['VIEW_CHANNEL']
                }
            ]
        })
        .then(channel => {
            // Envoyer l'embed dans le salon du ticket
            channel.send({ embeds: [embed] })
            .then(sentMessage => {
                // Ajouter un bouton pour fermer le ticket
                const closeTicketButton = new Discord.MessageButton()
                    .setStyle('DANGER')
                    .setLabel('Close Ticket')
                    .setCustomId('closeTicket');

                const row = new Discord.MessageActionRow().addComponents(closeTicketButton);
                sentMessage.channel.send({ content: 'React to close this ticket:', components: [row] });
            })
            .catch(err => console.error('Error sending message:', err));
        })
        .catch(err => console.error('Error creating channel:', err));
    } else if (command === 'close') {
        // Vérifier si le message a été envoyé dans un salon de ticket
        if (!message.channel.name.endsWith('-ticket')) {
            return message.channel.send("Cette commande ne peut être utilisée que dans un salon de ticket.");
        }

        // Supprimer le salon de ticket
        message.channel.delete()
            .then(() => console.log(`Ticket channel ${message.channel.name} closed.`))
            .catch(err => console.error('Error closing ticket:', err));
    }
});

    } else if (command === 'spam') {
        // Vérifie que l'utilisateur a la permission de supprimer des messages
        if (!message.member.permissions.has('MANAGE_MESSAGES')) {
            return message.channel.send("Vous n'avez pas la permission de supprimer des messages.");
        }

        // Récupère le texte à spam
        const textToSpam = args.join(' ');

        // Envoie le texte 20 fois
        for (let i = 0; i < 20; i++) {
            message.channel.send(textToSpam);
        }
    }
});

async function login() {
  try {
    await client.login(process.env.TOKEN);
    console.log(`\x1b[36m%s\x1b[0m`, `|    🐇 Logged in as ${client.user.tag}`);
  } catch (error) {
    console.error('Failed to log in:', error);
    process.exit(1);
  }
}

function parseDuration(durationString) {
    const regex = /(\d+)\s*(m|min|minute|minutes)/i;
    const matches = durationString.match(regex);
    if (!matches) return null;
    return parseInt(matches[1]);
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${remainingSeconds}s`;
}

login();
