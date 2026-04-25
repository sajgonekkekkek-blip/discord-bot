const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;

const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";

const CREATE_CHANNEL_ID = "1497611703280734428";
const VOICE_CATEGORY_ID = "1497524528060956723";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ================= STATE =================
const voiceOwners = new Map();
const voiceBans = new Map();
const voicePanels = new Map();

// ================= PERMS =================
function isMod(member) {
  return (
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(OWNER_ROLE) ||
    member.id === OWNER_ID
  );
}

// ================= READY =================
client.once("ready", async () => {
  console.log("BOT ONLINE");
});

// ================= VOICE CREATE =================
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (newState.channelId === CREATE_CHANNEL_ID) {

    const member = newState.member;

    const voice = await newState.guild.channels.create({
      name: `Kanał ${member.user.username}`,
      type: ChannelType.GuildVoice,
      parent: VOICE_CATEGORY_ID
    });

    const panel = await newState.guild.channels.create({
      name: `panel-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: VOICE_CATEGORY_ID,
      permissionOverwrites: [
        { id: newState.guild.id, deny: ["ViewChannel"] },
        { id: member.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    voiceOwners.set(voice.id, member.id);
    voiceBans.set(voice.id, new Set());

    await member.voice.setChannel(voice);

    const embed = new EmbedBuilder()
      .setTitle("🎛️ Panel kanału głosowego")
      .setColor("#5865F2")
      .setDescription(
`Zarządzanie kanałem:

🔒 Zamknij / Otwórz
✏️ Zmień nazwę
👢 Wyrzuć użytkownika
⛔ Ban / Unban

Kanał znika po 60 sekundach pustki.`
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lock_${voice.id}`).setLabel("Zamknij").setStyle(2),
      new ButtonBuilder().setCustomId(`unlock_${voice.id}`).setLabel("Otwórz").setStyle(2),
      new ButtonBuilder().setCustomId(`rename_${voice.id}`).setLabel("Rename").setStyle(1)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`kick_${voice.id}`).setLabel("Kick").setStyle(2),
      new ButtonBuilder().setCustomId(`ban_${voice.id}`).setLabel("Ban").setStyle(4),
      new ButtonBuilder().setCustomId(`unban_${voice.id}`).setLabel("Unban").setStyle(3),
      new ButtonBuilder().setCustomId(`delete_${voice.id}`).setLabel("Delete").setStyle(4)
    );

    await panel.send({ embeds: [embed], components: [row1, row2] });

    voicePanels.set(voice.id, panel.id);
  }

  // AUTO DELETE
  if (oldState.channelId && voiceOwners.has(oldState.channelId)) {

    const ch = oldState.channel;

    if (ch && ch.members.size === 0) {

      setTimeout(async () => {

        const check = oldState.guild.channels.cache.get(oldState.channelId);
        if (!check || check.members.size > 0) return;

        const panelId = voicePanels.get(oldState.channelId);
        const panel = oldState.guild.channels.cache.get(panelId);

        if (panel) panel.delete().catch(()=>{});

        voiceOwners.delete(oldState.channelId);
        voiceBans.delete(oldState.channelId);
        voicePanels.delete(oldState.channelId);

        check.delete().catch(()=>{});

      }, 60000);
    }
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ================= BUTTONS =================
  if (i.isButton()) {

    const [action, channelId] = i.customId.split("_");

    const channel = i.guild.channels.cache.get(channelId);
    if (!channel) return;

    const owner = voiceOwners.get(channelId);
    const bans = voiceBans.get(channelId);

    if (bans?.has(i.user.id))
      return i.reply({ content: "Zbanowany z kanału", ephemeral: true });

    if (i.user.id !== owner && !isMod(i.member))
      return i.reply({ content: "Brak dostępu", ephemeral: true });

    if (action === "lock") {
      await channel.permissionOverwrites.edit(i.guild.id, { Connect: false });
      return i.reply({ content: "Kanał zamknięty", ephemeral: true });
    }

    if (action === "unlock") {
      await channel.permissionOverwrites.edit(i.guild.id, { Connect: true });
      return i.reply({ content: "Kanał otwarty", ephemeral: true });
    }

    if (action === "rename") {

      const modal = new ModalBuilder()
        .setCustomId(`rename_${channelId}`)
        .setTitle("Zmiana nazwy");

      const input = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Nowa nazwa")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return i.showModal(modal);
    }

    if (action === "kick") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`kick_${channelId}`)
        .setPlaceholder("Wybierz użytkownika")
        .addOptions(
          channel.members.map(m => ({
            label: m.user.username,
            value: m.id
          }))
        );

      return i.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (action === "ban") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`ban_${channelId}`)
        .setPlaceholder("Wybierz użytkownika")
        .addOptions(
          channel.members.map(m => ({
            label: m.user.username,
            value: m.id
          }))
        );

      return i.reply({
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (action === "unban") {

      const list = voiceBans.get(channelId);

      return i.reply({
        content: `Zbanowani: ${[...list].join(", ") || "brak"}`,
        ephemeral: true
      });
    }

    if (action === "delete") {

      const panelId = voicePanels.get(channelId);
      const panel = i.guild.channels.cache.get(panelId);

      if (panel) panel.delete().catch(()=>{});

      voiceOwners.delete(channelId);
      voiceBans.delete(channelId);
      voicePanels.delete(channelId);

      return channel.delete();
    }
  }

  // ================= SELECT =================
  if (i.isStringSelectMenu()) {

    const [type, channelId] = i.customId.split("_");
    const channel = i.guild.channels.cache.get(channelId);

    if (!channel) return;

    const userId = i.values[0];

    if (type === "kick") {
      const m = await i.guild.members.fetch(userId);
      m.voice.disconnect();
      return i.reply({ content: "Wyrzucono", ephemeral: true });
    }

    if (type === "ban") {
      voiceBans.get(channelId).add(userId);
      const m = await i.guild.members.fetch(userId);
      m.voice.disconnect();
      return i.reply({ content: "Zbanowano", ephemeral: true });
    }
  }

  // ================= MODAL =================
  if (i.isModalSubmit()) {

    if (i.customId.startsWith("rename_")) {

      const channelId = i.customId.split("_")[1];
      const channel = i.guild.channels.cache.get(channelId);

      const name = i.fields.getTextInputValue("name");

      await channel.setName(name);

      return i.reply({ content: "Zmieniono nazwę", ephemeral: true });
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
