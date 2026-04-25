const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const Database = require("better-sqlite3");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;

const OWNER_ROLE = "1497524742868045934";
const MOD_ROLE = "1497541728306204712";

// ================= DATABASE =================
const db = new Database("data.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS xp (
  user TEXT PRIMARY KEY,
  xp INTEGER,
  lvl INTEGER
)`).run();

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("🏓 Pong"),

  new SlashCommandBuilder().setName("panel").setDescription("🎫 Ticket panel (admin)"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 info usera")
    .addUserOption(o => o.setName("user").setDescription("user")),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("🧹 usuwa wiadomości")
    .addIntegerOption(o => o.setName("ilosc").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 ban user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 kick user")
    .addUserOption(o => o.setName("user").setRequired(true))
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("BOT READY");
});

// ================= PERMS =================
function hasPerm(member) {
  return (
    member.roles.cache.has(OWNER_ROLE) ||
    member.roles.cache.has(MOD_ROLE)
  );
}

// ================= LOG CHANNEL =================
function log(guild, msg) {
  const ch = guild.channels.cache.find(c => c.name === "logs");
  if (ch) ch.send(`📋 ${msg}`);
}

// ================= LEVEL SYSTEM =================
function addXP(userId) {
  let data = db.prepare("SELECT * FROM xp WHERE user=?").get(userId);

  if (!data) {
    db.prepare("INSERT INTO xp VALUES (?,?,?)").run(userId, 0, 0);
    data = { xp: 0, lvl: 0 };
  }

  data.xp += 5;

  if (data.xp >= 100) {
    data.lvl++;
    data.xp = 0;
  }

  db.prepare("UPDATE xp SET xp=?, lvl=? WHERE user=?")
    .run(data.xp, data.lvl, userId);

  return data;
}

// ================= MESSAGE SYSTEM =================
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  const data = addXP(msg.author.id);

  // automod link
  if (msg.content.includes("http")) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      msg.delete().catch(() => {});
      msg.channel.send("🚫 linki zablokowane");
    }
  }

  // caps
  if (msg.content.length > 6 && msg.content === msg.content.toUpperCase()) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      msg.channel.send("⚠️ nie krzycz");
    }
  }

  if (data.xp === 0 && data.lvl > 0) {
    msg.channel.send(`📊 lvl up → ${data.lvl}`);
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ================= SLASH =================
  if (i.isChatInputCommand()) {

    if (i.commandName === "ping")
      return i.reply("🏓 pong");

    // ================= USERINFO =================
    if (i.commandName === "userinfo") {

      const user = i.options.getUser("user") || i.user;
      const member = await i.guild.members.fetch(user.id);

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👤 USER INFO")
            .setColor("#5865F2")
            .setThumbnail(user.displayAvatarURL())

            .setDescription(
`Nick: ${user.tag}
ID: ${user.id}
Konto: ${user.createdAt.toDateString()}
Dołączył: ${member.joinedAt?.toDateString()}

Role: ${member.roles.cache.map(r => r.name).slice(0, 10).join(", ")}`
            )
        ]
      });
    }

    // ================= PANEL =================
    if (i.commandName === "panel") {

      if (!hasPerm(i.member))
        return i.reply({ content: "❌ brak permisji", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription(
`System Ticketów:
System pozwala kontaktować się z administracją.

━━━━━━━━━━━━━━━━━━━━

Tworzenie ticketu:
Kliknij przycisk, aby stworzyć prywatny kanał.

━━━━━━━━━━━━━━━━━━━━

Korzystanie:
Opisz problem dokładnie.

━━━━━━━━━━━━━━━━━━━━

Zamykanie:
Ticket zamyka staff.

━━━━━━━━━━━━━━━━━━━━

Zasady:
• brak spamu
• brak multi ticketów
• kultura`
        )
        .setColor("#2b2d31");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_support")
          .setLabel("💬 Support")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ticket_report")
          .setLabel("🚨 Report")
          .setStyle(ButtonStyle.Danger)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    // ================= CLEAR =================
    if (i.commandName === "clear") {

      if (!hasPerm(i.member))
        return i.reply({ content: "❌ brak permisji", ephemeral: true });

      const amount = i.options.getInteger("ilosc");

      await i.channel.bulkDelete(amount);

      return i.reply({
        content: `🧹 usunięto ${amount}`,
        ephemeral: true
      });
    }

    // ================= BAN =================
    if (i.commandName === "ban") {

      if (!hasPerm(i.member))
        return i.reply({ content: "❌ brak permisji", ephemeral: true });

      const user = i.options.getUser("user");
      const m = await i.guild.members.fetch(user.id);

      await m.ban();

      log(i.guild, `BAN: ${user.tag}`);

      return i.reply(`🔨 zbanowano ${user.tag}`);
    }

    // ================= KICK =================
    if (i.commandName === "kick") {

      if (!hasPerm(i.member))
        return i.reply({ content: "❌ brak permisji", ephemeral: true });

      const user = i.options.getUser("user");
      const m = await i.guild.members.fetch(user.id);

      await m.kick();

      log(i.guild, `KICK: ${user.tag}`);

      return i.reply(`👢 wyrzucono ${user.tag}`);
    }
  }

  // ================= BUTTONS =================
  if (i.isButton()) {

    const guild = i.guild;

    let cat = guild.channels.cache.find(c => c.name === "🎫・TICKETS");

    if (!cat) {
      cat = await guild.channels.create({
        name: "🎫・TICKETS",
        type: ChannelType.GuildCategory
      });
    }

    // ================= CREATE TICKET =================
    if (i.customId.startsWith("ticket_")) {

      const ch = await guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: cat.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: MOD_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("🎫 TICKET OTWARTY")
        .setDescription(
`Status: OPEN

Opisz problem dokładnie.
Staff został powiadomiony.`
        )
        .setColor("Green");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim")
          .setLabel("🔓 Claim")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("close")
          .setLabel("❌ Close")
          .setStyle(ButtonStyle.Danger)
      );

      ch.send({
        content: `<@&${MOD_ROLE}> <@${i.user.id}>`,
        embeds: [embed],
        components: [row]
      });

      return i.reply({ content: "🎫 stworzono ticket", ephemeral: true });
    }

    // ================= CLAIM =================
    if (i.customId === "claim") {

      await i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("claimed")
              .setLabel("🔒 CLAIMED")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),

            new ButtonBuilder()
              .setCustomId("close")
              .setLabel("❌ Close")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });

      return i.channel.send(`🔒 przejęty przez ${i.user}`);
    }

    // ================= CLOSE =================
    if (i.customId === "close") {

      await i.channel.send("❌ zamykam ticket...");
      log(i.guild, `Ticket closed: ${i.channel.name}`);

      setTimeout(() => i.channel.delete(), 4000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
