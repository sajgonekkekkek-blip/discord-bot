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
const ROLE_OWNER = "1497524742868045934"; // może wszystko
const ROLE_MOD = "1497541728306204712";

// wezwania
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

// ================= DB =================
const db = new Database("xp.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS xp (
  user TEXT PRIMARY KEY,
  xp INTEGER,
  lvl INTEGER
)`).run();

// ================= SYSTEM =================
let ticketID = 0;
const tickets = new Map();
const cooldown = new Map();

// ================= PERMISJE =================
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

// ================= KOMENDY =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Sprawdza działanie bota"),
  new SlashCommandBuilder().setName("panel").setDescription("Panel systemu ticketów"),
  new SlashCommandBuilder().setName("userinfo").setDescription("Informacje o użytkowniku")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ================= READY =================
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

  addXP(msg.author.id);

  // linki
  if (msg.content.includes("http")) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      msg.delete().catch(()=>{});
      msg.channel.send("🚫 Linki są zablokowane");
    }
  }

  // caps
  if (msg.content.length > 6 && msg.content === msg.content.toUpperCase()) {
    msg.channel.send("⚠️ Nie krzycz");
  }

  // wezwania
  if (msg.content.startsWith("!w")) {

    const t = tickets.get(msg.channel.id);
    if (!t || t.claimed)
      return msg.reply("❌ Najpierw ticket musi być oddany (unclaim)");

    const cd = cooldown.get(msg.author.id) || 0;
    if (Date.now() - cd < 15000)
      return msg.reply("⏳ Poczekaj 15 sekund");

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
          .setTitle("🚨 WEZWANIE ADMINISTRACJI")
          .setColor("#ED4245")
          .setDescription(`Użytkownik ${msg.author} prosi o pomoc w tickecie`)
      ],
      content: roles.map(r => `<@&${r}>`).join(" ")
    });
  }
});

// ================= INTERAKCJE =================
client.on("interactionCreate", async (i) => {

  // ===== SLASH =====
  if (i.isChatInputCommand()) {

    if (i.commandName === "ping")
      return i.reply("🏓 Bot działa poprawnie");

    // ===== PANEL =====
    if (i.commandName === "panel") {

      if (!maDostep(i.member))
        return i.reply({ content: "❌ Brak dostępu", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 SYSTEM TICKETÓW")
        .setColor("#5865F2")
        .setDescription(
`📌 SYSTEM TICKETÓW SERWERA

━━━━━━━━━━━━━━━━━━━━
System umożliwia kontakt z administracją.

Każdy ticket to prywatny kanał.

━━━━━━━━━━━━━━━━━━━━
📁 TWORZENIE

Kliknij przycisk aby utworzyć ticket.

━━━━━━━━━━━━━━━━━━━━
💬 ZASADY

• opisz problem dokładnie
• nie spamuj
• zachowuj kulturę

━━━━━━━━━━━━━━━━━━━━
🔒 ZAMYKANIE

Ticket zamyka administracja lub użytkownik

━━━━━━━━━━━━━━━━━━━━`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_help")
          .setLabel("Pomoc")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("ticket_report")
          .setLabel("Zgłoszenie")
          .setStyle(ButtonStyle.Danger)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    // ===== USERINFO =====
    if (i.commandName === "userinfo") {

      const u = i.options.getUser("user") || i.user;
      const m = await i.guild.members.fetch(u.id);

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👤 INFORMACJE O UŻYTKOWNIKU")
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

  // ===== BUTTONS =====
  if (i.isButton()) {

    const g = i.guild;

    // ===== TICKET CREATE =====
    if (i.customId.startsWith("ticket")) {

      ticketID++;
      const num = ticketID.toString().padStart(4, "0");

      const ch = await g.channels.create({
        name: `ticket-${num}`,
        type: ChannelType.GuildText,
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
        .setDescription("Opisz swój problem, administracja wkrótce odpowie.");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Przejmij ticket").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("Oddaj ticket").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("Zamknij ticket").setStyle(ButtonStyle.Danger)
      );

      ch.send({ content: `<@&${ROLE_MOD}> <@${i.user.id}>`, embeds: [embed], components: [row] });

      return i.reply({ content: `Ticket #${num} utworzony`, ephemeral: true });
    }

    // ===== CLAIM =====
    if (i.customId === "claim") {

      const t = tickets.get(i.channel.id);

      if (i.user.id === t.owner && !i.member.roles.cache.has(ROLE_OWNER))
        return i.reply({ content: "❌ Nie możesz przejąć własnego ticketu", ephemeral: true });

      t.claimed = true;

      const embed = new EmbedBuilder()
        .setTitle("🔒 Ticket przejęty")
        .setColor("#F1C40F")
        .setDescription(`Ticket został przejęty przez ${i.user}`);

      await i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("unclaim").setLabel("Oddaj ticket").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("close").setLabel("Zamknij ticket").setStyle(ButtonStyle.Danger)
          )
        ]
      });

      return i.channel.send({ embeds: [embed] });
    }

    // ===== UNCLAIM =====
    if (i.customId === "unclaim") {

      const t = tickets.get(i.channel.id);
      t.claimed = false;

      const embed = new EmbedBuilder()
        .setTitle("🔓 Ticket oddany")
        .setColor("#3498DB")
        .setDescription(`Ticket został oddany przez ${i.user}`);

      await i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("claim").setLabel("Przejmij ticket").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("close").setLabel("Zamknij ticket").setStyle(ButtonStyle.Danger)
          )
        ]
      });

      return i.channel.send({ embeds: [embed] });
    }

    // ===== CLOSE =====
    if (i.customId === "close") {

      const t = tickets.get(i.channel.id);

      const msgs = await i.channel.messages.fetch({ limit: 50 });

      let log = [];
      msgs.reverse().forEach(m => log.push(`${m.author.tag}: ${m.content}`));

      const user = await client.users.fetch(t.owner);

      await user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📁 TRANSCRIPT TICKETA #${t.num}`)
            .setColor("#5865F2")
        ],
        files: [{
          attachment: Buffer.from(log.join("\n"), "utf8"),
          name: `ticket-${t.num}.txt`
        }]
      }).catch(()=>{});

      tickets.delete(i.channel.id);

      await i.channel.send("❌ Zamykam ticket...");

      setTimeout(() => i.channel.delete(), 3000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
