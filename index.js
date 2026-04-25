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

// ================= TOKEN =================
const TOKEN = process.env.TOKEN;

// ================= ROLE =================
const ROLE_OWNER = "1497524742868045934";
const ROLE_MOD = "1497541728306204712";

// wezwania staff
const W1 = "1497527981822709840";
const W2 = ["1497527830559588452","1497527748997157015"];
const W3 = ["1497527663781351495","1497527565617729587","1497527457622790214"];
const W4 = ["1497527300848091288","1497527197886447656"];
const W5 = ["1497528458711138406","1497529283537797130","1497529477150933023"];

// ================= BOT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= DB XP =================
const db = new Database("xp.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS xp (
  user TEXT PRIMARY KEY,
  xp INTEGER,
  lvl INTEGER
)`).run();

// ================= SYSTEM TICKETS =================
let ticketID = 0;
const tickets = new Map();
const cooldown = new Map();

// ================= PERMS =================
function maDostep(m) {
  return (
    m.roles.cache.has(ROLE_OWNER) ||
    m.roles.cache.has(ROLE_MOD)
  );
}

// ================= XP =================
function addXP(id) {
  let u = db.prepare("SELECT * FROM xp WHERE user=?").get(id);

  if (!u) {
    db.prepare("INSERT INTO xp VALUES (?,?,?)").run(id, 0, 0);
    u = { xp: 0, lvl: 0 };
  }

  u.xp += 5;

  if (u.xp >= 100) {
    u.lvl++;
    u.xp = 0;
  }

  db.prepare("UPDATE xp SET xp=?, lvl=? WHERE user=?")
    .run(u.xp, u.lvl, id);

  return u;
}

// ================= COMMANDY =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("sprawdza bota"),

  new SlashCommandBuilder().setName("panel").setDescription("panel ticketów"),

  new SlashCommandBuilder().setName("userinfo").setDescription("info usera")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );
});

// ================= MESSAGE =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const xp = addXP(msg.author.id);

  // linki
  if (msg.content.includes("http")) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      msg.delete().catch(() => {});
      msg.channel.send("🚫 linki zablokowane");
    }
  }

  // caps
  if (msg.content.length > 6 && msg.content === msg.content.toUpperCase()) {
    msg.channel.send("⚠️ nie krzycz");
  }

  if (xp.xp === 0 && xp.lvl > 0) {
    msg.channel.send(`📊 level up: ${xp.lvl}`);
  }

  // ================= WEZWANIA =================
  if (msg.content.startsWith("!w")) {

    const t = tickets.get(msg.channel.id);

    if (!t || t.claimed)
      return msg.reply("❌ najpierw unclaim ticket");

    const cd = cooldown.get(msg.author.id) || 0;
    if (Date.now() - cd < 15000)
      return msg.reply("⏳ cooldown 15s");

    cooldown.set(msg.author.id, Date.now());

    let roles = [];

    if (msg.content === "!w1") roles = [W1];
    if (msg.content === "!w2") roles = W2;
    if (msg.content === "!w3") roles = W3;
    if (msg.content === "!w4") roles = W4;
    if (msg.content === "!w5") roles = W5;

    msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🚨 WEZWANIE STAFF")
          .setDescription(`Użytkownik ${msg.author} prosi o pomoc`)
          .setColor("#ED4245")
      ],
      content: roles.map(r => `<@&${r}>`).join(" ")
    });
  }
});

// ================= INTERACTION =================
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "ping")
      return i.reply("🏓 działa");

    // ================= PANEL =================
    if (i.commandName === "panel") {

      if (!maDostep(i.member))
        return i.reply({ content: "❌ brak dostępu", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 SYSTEM TICKETÓW")
        .setColor("#5865F2")
        .setDescription(
`System ticketów:

• Support / Report
• prywatne kanały
• pełna moderacja`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_support")
          .setLabel("Support")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("ticket_report")
          .setLabel("Report")
          .setStyle(ButtonStyle.Danger)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    // ================= USERINFO =================
    if (i.commandName === "userinfo") {

      const u = i.options.getUser("user") || i.user;
      const m = await i.guild.members.fetch(u.id);

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👤 USERINFO")
            .setColor("#5865F2")
            .setThumbnail(u.displayAvatarURL())
            .setDescription(
`Nick: ${u.tag}
ID: ${u.id}
Konto: ${u.createdAt.toDateString()}
Dołączył: ${m.joinedAt?.toDateString()}`
            )
        ]
      });
    }
  }

  // ================= BUTTONS =================
  if (i.isButton()) {

    const g = i.guild;

    // ================= CREATE TICKET =================
    if (i.customId.startsWith("ticket")) {

      ticketID++;

      const num = ticketID.toString().padStart(4, "0");

      const cat = await g.channels.create({
        name: "TICKETY",
        type: ChannelType.GuildCategory
      });

      const ch = await g.channels.create({
        name: `ticket-${num}`,
        type: ChannelType.GuildText,
        parent: cat.id,
        permissionOverwrites: [
          { id: g.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel","SendMessages"] },
          { id: ROLE_MOD, allow: ["ViewChannel","SendMessages"] }
        ]
      });

      tickets.set(ch.id, {
        owner: i.user.id,
        claimed: false,
        num
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎫 TICKET #${num}`)
        .setColor("#57F287")
        .setDescription("Opisz problem. Staff został powiadomiony.");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      ch.send({ content: `<@&${ROLE_MOD}> <@${i.user.id}>`, embeds: [embed], components: [row] });

      return i.reply({ content: `Ticket #${num} utworzony`, ephemeral: true });
    }

    // ================= CLAIM =================
    if (i.customId === "claim") {

      const t = tickets.get(i.channel.id);

      if (i.user.id === t.owner)
        return i.reply({ content: "❌ nie możesz przejąć swojego ticketu", ephemeral: true });

      if (!maDostep(i.member))
        return i.reply({ content: "❌ brak dostępu", ephemeral: true });

      t.claimed = true;

      return i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }

    // ================= UNCLAIM =================
    if (i.customId === "unclaim") {

      const t = tickets.get(i.channel.id);
      t.claimed = false;

      return i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }

    // ================= CLOSE + TRANSCRIPT =================
    if (i.customId === "close") {

      const t = tickets.get(i.channel.id);

      const msgs = await i.channel.messages.fetch({ limit: 50 });

      let log = [];
      msgs.reverse().forEach(m => log.push(`${m.author.tag}: ${m.content}`));

      const user = await client.users.fetch(t.owner);

      await user.send({
        files: [{
          attachment: Buffer.from(log.join("\n"), "utf8"),
          name: `ticket-${t.num}.txt`
        }]
      }).catch(()=>{});

      tickets.delete(i.channel.id);

      await i.channel.send("❌ zamykanie...");

      setTimeout(() => i.channel.delete(), 3000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
