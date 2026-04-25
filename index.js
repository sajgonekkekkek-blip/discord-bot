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

const TOKEN = process.env.TOKEN;

// ================= CONFIG =================
const OWNER_ID = "1311750832374419535";

const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= STATE =================
let ticketCounter = 0;
const cooldown = new Set();
const closeConfirm = new Map();

// ================= PERMISSIONS =================
function hasMod(member) {
  if (!member) return false;

  return (
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(OWNER_ROLE) ||
    member.id === OWNER_ID
  );
}

// =====================================================
// SLASH COMMANDS REGISTER
// =====================================================
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Panel ticketów"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Informacje o użytkowniku")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Czyści wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc").setDescription("Ilość").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Bot pisze wiadomość")
    .addStringOption(o =>
      o.setName("text").setDescription("Treść").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban user")
    .addStringOption(o =>
      o.setName("id").setDescription("ID").setRequired(true)
    )
].map(c => c.toJSON());

// =====================================================
// READY
// =====================================================
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("BOT ONLINE");
});

// =====================================================
// INTERACTIONS
// =====================================================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand() && !i.isButton()) return;

  // ================= PANEL =================
  if (i.isChatInputCommand() && i.commandName === "panel") {

    const embed = new EmbedBuilder()
      .setTitle("🎫 SYSTEM TICKETÓW")
      .setColor("#5865F2")
      .setDescription(
`Ticket System:
Ten system pozwala kontaktować się z administracją serwera.

━━━━━━━━━━━━━━━━━━━━

Tworzenie:
Kliknij przycisk i stwórz prywatny kanał.

━━━━━━━━━━━━━━━━━━━━

Używanie:
Opisz problem dokładnie.

━━━━━━━━━━━━━━━━━━━━

Zamykanie:
Wymaga potwierdzenia.

━━━━━━━━━━━━━━━━━━━━

Regulamin:
- brak spamu
- brak multi ticketów
- kultura`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_report").setLabel("Report").setStyle(ButtonStyle.Danger)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  // ================= CREATE TICKET =================
  if (i.isButton() && (i.customId === "ticket_help" || i.customId === "ticket_report")) {

    ticketCounter++;
    const id = String(ticketCounter).padStart(4, "0");

    const channel = await i.guild.channels.create({
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
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@&${MOD_ROLE}>`,
      embeds: [embed],
      components: [row]
    });

    return i.reply({ ephemeral: true, content: "Ticket stworzony" });
  }

  // ================= CLAIM =================
  if (i.isButton() && i.customId === "claim") {

    if (!hasMod(i.member))
      return i.reply({ ephemeral: true, content: "Brak uprawnień" });

    return i.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📌 CLAIM")
          .setColor("#FEE75C")
          .setDescription(`Przejął: <@${i.user.id}>`)
      ]
    });
  }

  // ================= UNCLAIM =================
  if (i.isButton() && i.customId === "unclaim") {

    if (!hasMod(i.member))
      return i.reply({ ephemeral: true, content: "Brak uprawnień" });

    return i.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("↩ UNCLAIM")
          .setColor("#FFB02E")
          .setDescription("Oddano ticket")
      ]
    });
  }

  // ================= CLOSE =================
  if (i.isButton() && i.customId === "close") {

    closeConfirm.set(i.channel.id, i.user.id);

    return i.reply({
      ephemeral: true,
      content: "Na pewno zamknąć?",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("yes_close").setLabel("Tak").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("no_close").setLabel("Nie").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  if (i.customId === "yes_close") {
    if (closeConfirm.get(i.channel.id) !== i.user.id) return;

    await i.channel.send("Zamykanie...");
    setTimeout(() => i.channel.delete(), 2000);
  }

  if (i.customId === "no_close") {
    return i.update({ content: "Anulowano", components: [] });
  }
});

// =====================================================
// W1–W5 (MESSAGE)
// =====================================================
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  const member = m.member;
  if (!member) return;

  const cmd = m.content.toLowerCase();

  const run = async (roles, label) => {

    if (!hasMod(member)) return;

    if (cooldown.has(m.author.id))
      return m.reply("Cooldown 10s");

    cooldown.add(m.author.id);
    setTimeout(() => cooldown.delete(m.author.id), 10000);

    await m.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🚨 ALERT")
          .setColor("#FF3B3B")
          .setDescription(`User: <@${m.author.id}>\nTyp: ${label}`)
      ]
    });

    await m.channel.send(roles.map(r => `<@&${r}>`).join(" "));
  };

  if (cmd === "!w1") return run(["1497527981822709840"], "W1");
  if (cmd === "!w2") return run(["1497527830559588452","1497527748997157015"], "W2");
  if (cmd === "!w3") return run(["1497527663781351495","1497527565617729587","1497527457622790214"], "W3");
  if (cmd === "!w4") return run(["1497527300848091288","1497527197886447656"], "W4");
  if (cmd === "!w5") return run(["1497528458711138406","1497529283537797130","1497529477150933023"], "W5");
});

// =====================================================
client.login(TOKEN);
