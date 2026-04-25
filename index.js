const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

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

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497524742868045934";

const VOICE_CATEGORY_ID = "1497524528060956723";
const CREATE_CHANNEL_ID = "1497611703280734428";

// ================= DATA =================
let ticketId = 0;
const tickets = new Map();
const voiceOwners = new Map();

// ================= WEZWANIA =================
const W_ROLES = {
  w1: ["1497527981822709840"],
  w2: ["1497527830559588452", "1497527748997157015"],
  w3: ["1497527663781351495", "1497527565617729587", "1497527457622790214"],
  w4: ["1497527300848091288", "1497527197886447656"],
  w5: ["1497528458711138406", "1497529283537797130", "1497529477150933023"]
};

// ================= READY =================
client.once("ready", () => {
  console.log(`BOT ONLINE: ${client.user.tag}`);
});

// ================= WEZWANIA =================
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  if (W_ROLES[message.content]) {
    message.channel.send({
      content: `🚨 Wezwanie: ${W_ROLES[message.content].map(r => `<@&${r}>`).join(", ")}`
    });
  }
});

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Panel systemu"),
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("Info usera")
    .addUserOption(o => o.setName("user").setDescription("Użytkownik").setRequired(true)),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Czyści czat")
    .addIntegerOption(o => o.setName("ilosc").setDescription("Ilość").setRequired(true)),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban")
    .addStringOption(o => o.setName("id").setDescription("ID").setRequired(true))
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ===== SLASH =====
  if (i.isChatInputCommand()) {

    const member = i.member;
    const isMod = member.roles.cache.has(MOD_ROLE) || i.user.id === OWNER_ID;

    // PANEL
    if (i.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("SYSTEM PANEL")
        .setDescription("Ticket + Voice system");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("Ticket")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("create_voice")
          .setLabel("Stwórz kanał")
          .setStyle(ButtonStyle.Success)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    // INFO
    if (i.commandName === "info") {
      const user = i.options.getUser("user");
      const m = await i.guild.members.fetch(user.id);

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#00aaff")
            .setTitle("INFO USER")
            .addFields(
              { name: "Nick", value: user.tag },
              { name: "ID", value: user.id },
              { name: "Role", value: m.roles.cache.map(r => r.name).join(", ") }
            )
        ],
        ephemeral: true
      });
    }

    // CLEAR
    if (i.commandName === "clear") {
      if (!isMod) return i.reply({ content: "Brak dostępu", ephemeral: true });

      const amount = i.options.getInteger("ilosc");
      await i.channel.bulkDelete(amount, true);

      return i.reply({ content: "Wyczyszczono", ephemeral: true });
    }

    // BAN
    if (i.commandName === "ban") {
      if (!isMod) return i.reply({ content: "Brak dostępu", ephemeral: true });

      const user = i.options.getUser("user");
      await i.guild.members.ban(user.id);

      return i.reply({ content: "Zbanowano", ephemeral: true });
    }

    // UNBAN
    if (i.commandName === "unban") {
      if (!isMod) return i.reply({ content: "Brak dostępu", ephemeral: true });

      const id = i.options.getString("id");
      await i.guild.members.unban(id);

      return i.reply({ content: "Odbanowano", ephemeral: true });
    }
  }

  // ===== BUTTONS =====

  // CREATE TICKET
  if (i.isButton() && i.customId === "create_ticket") {

    ticketId++;

    const ch = await i.guild.channels.create({
      name: `ticket-${ticketId}`,
      type: 0,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: MOD_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    tickets.set(ch.id, { owner: i.user.id, claimed: false });

    const embed = new EmbedBuilder()
      .setColor("#00aaff")
      .setTitle("TICKET")
      .setDescription("Opisz problem");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    ch.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "Ticket stworzony", ephemeral: true });
  }

  // CREATE VOICE
  if (i.isButton() && i.customId === "create_voice") {

    const name = `voice-${i.user.username}`;

    const ch = await i.guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: VOICE_CATEGORY_ID
    });

    voiceOwners.set(ch.id, i.user.id);

    return i.reply({ content: "Kanał utworzony", ephemeral: true });
  }

  // CLAIM
  if (i.isButton() && i.customId === "claim") {
    const t = tickets.get(i.channel.id);
    if (!t) return;

    t.claimed = true;
    return i.reply({ content: "Ticket przejęty", ephemeral: true });
  }

  // UNCLAIM
  if (i.isButton() && i.customId === "unclaim") {
    const t = tickets.get(i.channel.id);
    if (!t) return;

    t.claimed = false;
    return i.reply({ content: "Oddano ticket", ephemeral: true });
  }

  // CLOSE
  if (i.isButton() && i.customId === "close") {
    tickets.delete(i.channel.id);
    await i.channel.delete();
  }
});

// ================= VOICE AUTO DELETE =================
client.on("voiceStateUpdate", async (oldState) => {
  const ch = oldState.channel;
  if (!ch) return;

  if (ch.members.size === 0) {
    setTimeout(() => {
      if (ch.members.size === 0) ch.delete().catch(() => {});
    }, 60000);
  }
});

// ================= LOGIN =================
client.login(TOKEN);
