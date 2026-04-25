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
const db = new Database("data.db");

// ================= SETUP DB =================
db.prepare("CREATE TABLE IF NOT EXISTS xp (user TEXT, xp INTEGER, lvl INTEGER)").run();

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;

const OWNER_ROLE = "1497524742868045934";
const MOD_ROLE = "1497541728306204712";

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
  new SlashCommandBuilder().setName("ping").setDescription("🏓 pong"),
  new SlashCommandBuilder().setName("panel").setDescription("🎫 ticket panel"),
  new SlashCommandBuilder().setName("rank").setDescription("📊 level"),
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("V5 PRO READY");
});

// ================= PERM =================
function hasPerm(member) {
  return (
    member.roles.cache.has(OWNER_ROLE) ||
    member.roles.cache.has(MOD_ROLE)
  );
}

// ================= LOG =================
function log(guild, msg) {
  const ch = guild.channels.cache.find(c => c.name === "logs");
  if (ch) ch.send(`📋 ${msg}`);
}

// ================= XP =================
function addXP(userId) {
  let row = db.prepare("SELECT * FROM xp WHERE user=?").get(userId);

  if (!row) {
    db.prepare("INSERT INTO xp VALUES (?,?,?)").run(userId, 0, 0);
    row = { xp: 0, lvl: 0 };
  }

  row.xp += 5;

  if (row.xp >= 100) {
    row.lvl++;
    row.xp = 0;
  }

  db.prepare("UPDATE xp SET xp=?, lvl=? WHERE user=?")
    .run(row.xp, row.lvl, userId);

  return row;
}

// ================= MESSAGE SYSTEM =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const data = addXP(msg.author.id);

  // AUTOMOD
  const t = msg.content.toLowerCase();

  if (t.includes("http")) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await msg.delete();
      msg.channel.send(`🚫 linki zablokowane`);
    }
  }

  if (msg.content.length > 6 && msg.content === msg.content.toUpperCase()) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      msg.channel.send(`⚠️ nie krzycz`);
    }
  }

  if (data.xp === 0 && data.lvl > 0) {
    msg.channel.send(`📊 ${msg.author} level up → ${data.lvl}`);
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ===== SLASH =====
  if (i.isChatInputCommand()) {

    if (i.commandName === "ping")
      return i.reply("🏓 pong");

    // PANEL
    if (i.commandName === "panel") {

      if (!hasPerm(i.member))
        return i.reply({ content: "❌ brak permisji", ephemeral: true });

      await i.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 TICKET SYSTEM")
        .setDescription("Kliknij przycisk aby utworzyć ticket.")
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

      await i.channel.send({ embeds: [embed], components: [row] });

      return i.editReply("✅ wysłano panel");
    }

    // RANK
    if (i.commandName === "rank") {
      const row = db.prepare("SELECT * FROM xp WHERE user=?").get(i.user.id) || { xp: 0, lvl: 0 };

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📊 Rank")
            .setDescription(`Level: ${row.lvl}\nXP: ${row.xp}/100`)
            .setColor("Blue")
        ]
      });
    }
  }

  // ===== BUTTONS =====
  if (i.isButton()) {

    const guild = i.guild;

    let cat = guild.channels.cache.find(c => c.name === "🎫・TICKETS");

    if (!cat) {
      cat = await guild.channels.create({
        name: "🎫・TICKETS",
        type: ChannelType.GuildCategory
      });
    }

    // ================= TICKET =================
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
        .setTitle("🎫 OPEN")
        .setDescription("Opisz problem")
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

      return i.reply({ content: "🎫 ticket created", ephemeral: true });
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

    // ================= CLOSE + TRANSCRIPT =================
    if (i.customId === "close") {

      const messages = await i.channel.messages.fetch({ limit: 50 });
      let html = "<h1>Ticket Transcript</h1>";

      messages.reverse().forEach(m => {
        html += `<p><b>${m.author.tag}:</b> ${m.content}</p>`;
      });

      log(i.guild, `Ticket closed: ${i.channel.name}`);

      await i.channel.send("❌ zamykam ticket...");
      setTimeout(() => i.channel.delete(), 4000);
    }
  }
});

// ================= ANTI RAID =================
client.on("guildMemberAdd", async (member) => {
  const logs = member.guild.channels.cache.find(c => c.name === "logs");
  if (logs) logs.send(`👋 join: ${member.user.tag}`);
});

// ================= LOGIN =================
client.login(TOKEN);
