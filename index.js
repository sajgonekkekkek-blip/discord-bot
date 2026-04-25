require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// 🔧 CONFIG
const JOIN_CHANNEL_ID = "1497611703280734428";
const CATEGORY_ID = "TU_DAJ_ID_KATEGORII";

client.once("ready", () => {
    console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

// 📢 SYSTEM KANAŁÓW
client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
        // WEJŚCIE NA KANAŁ TWORZENIA
        if (newState.channelId === JOIN_CHANNEL_ID) {
            const guild = newState.guild;
            const member = newState.member;

            const channel = await guild.channels.create({
                name: `Kanał ${member.user.username}`,
                type: ChannelType.GuildVoice,
                parent: CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionsBitField.Flags.Connect],
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.ManageChannels,
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers,
                            PermissionsBitField.Flags.MoveMembers,
                        ],
                    },
                ],
            });

            await member.voice.setChannel(channel);

            // PANEL
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rename_${channel.id}`)
                    .setLabel("Zmień nazwę")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId(`lock_${channel.id}`)
                    .setLabel("Zablokuj")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId(`unlock_${channel.id}`)
                    .setLabel("Odblokuj")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId(`delete_${channel.id}`)
                    .setLabel("Usuń kanał")
                    .setStyle(ButtonStyle.Danger)
            );

            try {
                await member.send({
                    content: `🎛️ Panel do zarządzania kanałem: **${channel.name}**`,
                    components: [row],
                });
            } catch {
                console.log("❌ Nie można wysłać DM");
            }
        }

        // 🗑️ USUWANIE PUSTYCH KANAŁÓW
        if (oldState.channel && oldState.channel.parentId === CATEGORY_ID) {
            if (oldState.channel.members.size === 0) {
                await oldState.channel.delete().catch(() => {});
            }
        }
    } catch (err) {
        console.log(err);
    }
});

// 🎛️ OBSŁUGA PRZYCISKÓW
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, channelId] = interaction.customId.split("_");
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel) {
        return interaction.reply({ content: "❌ Kanał nie istnieje.", ephemeral: true });
    }

    switch (action) {
        case "rename":
            await channel.setName(`Kanał ${interaction.user.username}`);
            return interaction.reply({ content: "✅ Zmieniono nazwę!", ephemeral: true });

        case "lock":
            await channel.permissionOverwrites.edit(interaction.guild.id, {
                Connect: false,
            });
            return interaction.reply({ content: "🔒 Kanał zablokowany!", ephemeral: true });

        case "unlock":
            await channel.permissionOverwrites.edit(interaction.guild.id, {
                Connect: true,
            });
            return interaction.reply({ content: "🔓 Kanał odblokowany!", ephemeral: true });

        case "delete":
            await channel.delete();
            return interaction.reply({ content: "🗑️ Kanał usunięty!", ephemeral: true });
    }
});

client.login(process.env.TOKEN);
