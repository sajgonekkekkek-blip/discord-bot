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

// ================= KONFIGURACJA =================
const TOKEN = process.env.TOKEN;

const ROLA_WŁAŚCICIEL = "1497524742868045934";
const ROLA_MODERATOR = "1497541728306204712";

// role wezwan
const ROLE_W1 = "1497527981822709840";
const ROLE_W2 = ["1497527830559588452","1497527748997157015"];
const ROLE_W3 = ["1497527663781351495","1497527565617729587","1497527457622790214"];
const ROLE_W4 = ["1497527300848091288","1497527197886447656"];
const ROLE_W5 = ["1497528458711138406","1497529283537797130","1497529477150933023"];

// ================= BAZA DANYCH =================
const db = new Database("dane.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS poziomy (
  uzytkownik TEXT PRIMARY KEY,
  xp INTEGER,
  poziom INTEGER
)`).run();

// ================= KLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= DANE POMOCNICZE =================
const ticketStatus = new Map();
const cooldownWezwan = new Map();

// ================= KOMENDY =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Sprawdza działanie bota"),

  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów (dla administracji)"),

  new SlashCommandBuilder().setName("userinfo").setDescription("Informacje o użytkowniku")
].map(c => c.toJSON());

// ================= REJESTRACJA =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Bot działa poprawnie");
});

// ================= PERMISJE =================
function czyMaDostep(member) {
  return (
    member.roles.cache.has(ROLA_WŁAŚCICIEL) ||
    member.roles.cache.has(ROLA_MODERATOR)
  );
}

// ================= XP SYSTEM =================
function dodajXP(id) {
  let dane = db.prepare("SELECT * FROM poziomy WHERE uzytkownik=?").get(id);

  if (!dane) {
    db.prepare("INSERT INTO poziomy VALUES (?,?,?)").run(id, 0, 0);
    dane = { xp: 0, poziom: 0 };
  }

  dane.xp += 5;

  if (dane.xp >= 100) {
    dane.poziom++;
    dane.xp = 0;
  }

  db.prepare("UPDATE poziomy SET xp=?, poziom=? WHERE uzytkownik=?")
    .run(dane.xp, dane.poziom, id);

  return dane;
}

// ================= WIADOMOŚCI =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const dane = dodajXP(msg.author.id);

  // linki
  if (msg.content.includes("http")) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await msg.delete().catch(() => {});
      msg.channel.send("🚫 Linki są zablokowane");
    }
  }

  // caps
  if (msg.content.length > 6 && msg.content === msg.content.toUpperCase()) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      msg.channel.send("⚠️ Nie krzycz");
    }
  }

  if (dane.xp === 0 && dane.poziom > 0) {
    msg.channel.send(`📊 Awans! Twój poziom: ${dane.poziom}`);
  }

  // ================= WEZWANIA STAFF =================
  if (msg.content.startsWith("!w")) {

    const status = ticketStatus.get(msg.channel.id);

    if (!status || status.claimed) {
      return msg.reply("❌ Najpierw musisz odblokować ticket (unclaim)");
    }

    const cooldown = cooldownWezwan.get(msg.author.id) || 0;
    if (Date.now() - cooldown < 15000) {
      return msg.reply("⏳ Poczekaj 15 sekund przed kolejnym wezwaniem");
    }

    cooldownWezwan.set(msg.author.id, Date.now());

    let rolePing = [];

    if (msg.content === "!w1") rolePing = [ROLE_W1];
    if (msg.content === "!w2") rolePing = ROLE_W2;
    if (msg.content === "!w3") rolePing = ROLE_W3;
    if (msg.content === "!w4") rolePing = ROLE_W4;
    if (msg.content === "!w5") rolePing = ROLE_W5;

    msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🚨 WEZWANIE OBSŁUGI")
          .setDescription(
            `Użytkownik ${msg.author} wezwał pomoc!\n\n` +
            `Poziom wezwania: ${msg.content}\n` +
            `Proszę o reakcję administracji`
          )
          .setColor("#ED4245")
      ],
      content: rolePing.map(r => `<@&${r}>`).join(" ")
    });
  }
});

// ================= INTERAKCJE =================
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "ping")
      return i.reply("🏓 Bot działa poprawnie");

    // ================= PANEL =================
    if (i.commandName === "panel") {

      if (!czyMaDostep(i.member))
        return i.reply({ content: "❌ Brak uprawnień", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 SYSTEM TICKETÓW")
        .setDescription(
`System ticketów:

Umożliwia kontakt z administracją serwera.

━━━━━━━━━━━━━━━━━━━━

Tworzenie:
Kliknij przycisk aby otworzyć ticket.

━━━━━━━━━━━━━━━━━━━━

Korzystanie:
Opisz swój problem dokładnie.

━━━━━━━━━━━━━━━━━━━━

Zamykanie:
Ticket zamyka administracja.

━━━━━━━━━━━━━━━━━━━━

Zasady:
• brak spamu
• jeden problem = jeden ticket`
        )
        .setColor("#5865F2");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket")
          .setLabel("Otwórz ticket")
          .setStyle(ButtonStyle.Success)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    // ================= USERINFO =================
    if (i.commandName === "userinfo") {

      const user = i.options.getUser("user") || i.user;
      const member = await i.guild.members.fetch(user.id);

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👤 Informacje o użytkowniku")
            .setColor("#5865F2")
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
`Nick: ${user.tag}
ID: ${user.id}
Konto utworzone: ${user.createdAt.toDateString()}
Dołączył: ${member.joinedAt?.toDateString()}

Role: ${member.roles.cache.map(r => r.name).slice(0, 10).join(", ")}`
            )
        ]
      });
    }
  }

  // ================= PRZYCISKI =================
  if (i.isButton()) {

    const guild = i.guild;

    if (i.customId === "ticket") {

      const kategoria = guild.channels.cache.find(c => c.name === "TICKETY")
        || await guild.channels.create({ name: "TICKETY", type: ChannelType.GuildCategory });

      const kanal = await guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: kategoria.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: ROLA_MODERATOR, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      ticketStatus.set(kanal.id, { claimed: false });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket otwarty")
        .setDescription("Opisz swój problem. Administracja została powiadomiona.")
        .setColor("#57F287");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Przejmij").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("Oddaj").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
      );

      kanal.send({ content: `<@&${ROLA_MODERATOR}> <@${i.user.id}>`, embeds: [embed], components: [row] });

      return i.reply({ content: "Ticket utworzony", ephemeral: true });
    }

    // CLAIM
    if (i.customId === "claim") {
      ticketStatus.set(i.channel.id, { claimed: true });

      return i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("unclaim").setLabel("Oddaj").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }

    // UNCLAIM
    if (i.customId === "unclaim") {
      ticketStatus.set(i.channel.id, { claimed: false });

      return i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("claim").setLabel("Przejmij").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }

    // CLOSE
    if (i.customId === "close") {
      ticketStatus.delete(i.channel.id);

      await i.channel.send("Ticket zamykany...");

      setTimeout(() => i.channel.delete(), 4000);
    }
  }
});

// ================= START =================
client.login(TOKEN);
