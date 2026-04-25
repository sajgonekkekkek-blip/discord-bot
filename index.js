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
  ChannelType
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
let ticketCounter = 0;

const voiceOwners = new Map();
const voicePanels = new Map();
const voiceBans = new Map();
const voiceTimeouts = new Map();

// ================= PERMS =================
function isMod(member) {
  return (
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(OWNER_ROLE) ||
    member.id === OWNER_ID
  );
}

// ================= SLASH =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Informacje o użytkowniku")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    )
].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("BOT ONLINE");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "panel") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 PANEL TICKETÓW")
        .setColor("#5865F2")
        .setDescription("Kliknij aby utworzyć ticket");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_report").setLabel("Report").setStyle(ButtonStyle.Danger)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    if (i.commandName === "userinfo") {
      const u = i.options.getUser("user");

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("USER INFO")
            .setColor("#5865F2")
            .setDescription(`User: ${u.tag}\nID: ${u.id}`)
        ],
        ephemeral: true
      });
    }
  }

  if (!i.isButton()) return;

  // ================= TICKET =================
  if (i.customId === "ticket_help" || i.customId === "ticket_report") {

    ticketCounter++;
    const id = String(ticketCounter).padStart(4, "0");

    const ch = await i.guild.channels.create({
      name: `ticket-${id}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
        { id: MOD_ROLE, allow: ["ViewChannel", "SendMessages"] },
        { id: OWNER_ROLE, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 TICKET #${id}`)
      .setColor("#57F287")
      .setDescription("Opisz problem");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(2),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(2),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(4)
    );

    await ch.send({ content: `<@&${MOD_ROLE}>`, embeds: [embed], components: [row] });

    return i.reply({ content: "ticket utworzony", ephemeral: true });
  }

  // ================= VOICE ACTIONS =================
  const [action, channelId] = i.customId.split("_");

  if (voiceOwners.has(channelId)) {

    const channel = i.guild.channels.cache.get(channelId);
    const owner = voiceOwners.get(channelId);
    const bans = voiceBans.get(channelId);

    if (!channel) return;

    // block banned users
    if (bans?.has(i.user.id)) {
      return i.reply({ content: "Jesteś zbanowany z tego kanału", ephemeral: true });
    }

    // owner check
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
      await channel.setName(`voice-${Date.now()}`);
      return i.reply({ content: "Zmieniono nazwę", ephemeral: true });
    }

    if (action === "kick") {
      const target = channel.members.first();
      if (!target) return i.reply({ content: "Brak osób", ephemeral: true });
      target.voice.disconnect();
      return i.reply({ content: "Wyrzucono", ephemeral: true });
    }

    if (action === "ban") {
      const target = channel.members.first();
      if (!target) return i.reply({ content: "Brak osób", ephemeral: true });

      bans.add(target.id);
      target.voice.disconnect();

      return i.reply({ content: "Zbanowano z kanału", ephemeral: true });
    }

    if (action === "unban") {
      const target = channel.members.first();
      if (!target) return i.reply({ content: "Brak osób", ephemeral: true });

      bans.delete(target.id);
      return i.reply({ content: "Odbanowano", ephemeral: true });
    }

    if (action === "delete") {
      voiceOwners.delete(channelId);
      voiceBans.delete(channelId);
      channel.delete().catch(()=>{});
    }
  }
});

// ================= VOICE CREATE =================
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (newState.channelId === CREATE_CHANNEL_ID) {

    const member = newState.member;

    const channel = await newState.guild.channels.create({
      name: `Kanał ${member.user.username}`,
      type: ChannelType.GuildVoice,
      parent: VOICE_CATEGORY_ID
    });

    voiceOwners.set(channel.id, member.id);
    voiceBans.set(channel.id, new Set());

    await member.voice.setChannel(channel);

    const panel = await newState.guild.channels.create({
      name: `panel-${member.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: newState.guild.id, deny: ["ViewChannel"] },
        { id: member.id, allow: ["ViewChannel"] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("🎛️ Panel kanału")
      .setColor("#5865F2")
      .setDescription(
`Zarządzaj kanałem:

🔒 Zamknij
🔓 Otwórz
✏️ Zmień nazwę
👢 Wyrzuć
⛔ Ban
🟢 Unban
❌ Usuń`
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lock_${channel.id}`).setLabel("Zamknij").setStyle(2),
      new ButtonBuilder().setCustomId(`unlock_${channel.id}`).setLabel("Otwórz").setStyle(2),
      new ButtonBuilder().setCustomId(`rename_${channel.id}`).setLabel("Rename").setStyle(1)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`kick_${channel.id}`).setLabel("Kick").setStyle(2),
      new ButtonBuilder().setCustomId(`ban_${channel.id}`).setLabel("Ban").setStyle(4),
      new ButtonBuilder().setCustomId(`unban_${channel.id}`).setLabel("Unban").setStyle(3),
      new ButtonBuilder().setCustomId(`delete_${channel.id}`).setLabel("Delete").setStyle(4)
    );

    const msg = await panel.send({ embeds: [embed], components: [row1, row2] });

    voicePanels.set(channel.id, panel.id);
  }

  // AUTO DELETE + PANEL DELETE + 1 MIN EMPTY
  if (oldState.channelId && voiceOwners.has(oldState.channelId)) {

    const channel = oldState.channel;

    if (!channel) return;

    if (channel.members.size === 0) {

      const timeout = setTimeout(() => {

        const ch = oldState.guild.channels.cache.get(oldState.channelId);
        if (!ch || ch.members.size > 0) return;

        const panelId = voicePanels.get(oldState.channelId);
        const panel = oldState.guild.channels.cache.get(panelId);

        if (panel) panel.delete().catch(()=>{});

        voiceOwners.delete(oldState.channelId);
        voicePanels.delete(oldState.channelId);
        voiceBans.delete(oldState.channelId);

        ch.delete().catch(()=>{});

      }, 60000);

      voiceTimeouts.set(oldState.channelId, timeout);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
