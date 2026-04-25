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
  PermissionsBitField
} = require("discord.js");

const TOKEN = process.env.TOKEN;

// ================= ID / ROLE =================
const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ================= STATE =================
let ticketID = 0;
const tickets = new Map();
const confirmClose = new Map();

// ================= HELPERS =================
const isOwner = (i) => i.user.id === OWNER_ID;

const isMod = (member) =>
  member.roles.cache.has(MOD_ROLE) ||
  member.roles.cache.has(OWNER_ROLE);

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Otwiera panel ticketów"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Informacje o użytkowniku")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Użytkownik")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Czyści wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc")
        .setDescription("Ilość")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Bot wysyła wiadomość")
    .addStringOption(o =>
      o.setName("text")
        .setDescription("Treść")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banuje użytkownika")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Użytkownik")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Odbanowuje użytkownika")
    .addStringOption(o =>
      o.setName("id")
        .setDescription("ID")
        .setRequired(true)
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

  if (!i.isChatInputCommand() && !i.isButton()) return;

  // ================= PANEL =================
  if (i.isChatInputCommand() && i.commandName === "panel") {

    if (!isOwner(i))
      return i.reply({ ephemeral: true, content: "Brak dostępu" });

    const embed = new EmbedBuilder()
      .setTitle("🎫 PANEL TICKETÓW")
      .setColor("#5865F2")
      .setDescription("Kliknij aby otworzyć ticket");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_report").setLabel("Zgłoszenie").setStyle(ButtonStyle.Danger)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  // ================= CREATE TICKET =================
  if (i.isButton() && (i.customId === "ticket_help" || i.customId === "ticket_report")) {

    ticketID++;
    const num = String(ticketID).padStart(4, "0");

    const ch = await i.guild.channels.create({
      name: `ticket-${num}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
        { id: MOD_ROLE, allow: ["ViewChannel", "SendMessages"] },
        { id: OWNER_ROLE, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    tickets.set(ch.id, {
      owner: i.user.id,
      claimed: false,
      claimedBy: null
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 TICKET #${num}`)
      .setColor("#57F287")
      .setDescription("Opisz problem dokładnie.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await ch.send({
      content: `<@&${MOD_ROLE}>`,
      embeds: [embed],
      components: [row]
    });

    return i.reply({ ephemeral: true, content: `Ticket #${num} utworzony` });
  }

  // ================= CLAIM =================
  if (i.isButton() && i.customId === "claim") {

    if (!isMod(i.member))
      return i.reply({ ephemeral: true, content: "Brak uprawnień" });

    const t = tickets.get(i.channel.id);
    if (!t) return;

    t.claimed = true;
    t.claimedBy = i.user.id;

    return i.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📌 Ticket przejęty")
          .setColor("#FEE75C")
          .setDescription(`Przejął: <@${i.user.id}>`)
      ]
    });
  }

  // ================= UNCLAIM =================
  if (i.isButton() && i.customId === "unclaim") {

    if (!isMod(i.member))
      return i.reply({ ephemeral: true, content: "Brak uprawnień" });

    const t = tickets.get(i.channel.id);
    if (!t) return;

    t.claimed = false;
    t.claimedBy = null;

    return i.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("↩ Ticket oddany")
          .setColor("#FFB02E")
          .setDescription("Ticket wrócił do administracji")
      ]
    });
  }

  // ================= CLOSE (CONFIRM BOTH SIDES) =================
  if (i.isButton() && i.customId === "close") {

    const isAdmin = isMod(i.member);

    confirmClose.set(i.channel.id, i.user.id);

    return i.reply({
      ephemeral: true,
      content: isAdmin
        ? "Admin: na pewno zamknąć ticket?"
        : "Czy na pewno chcesz zamknąć ticket?",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("yes_close").setLabel("Tak").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("no_close").setLabel("Nie").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  if (i.customId === "yes_close") {

    if (confirmClose.get(i.channel.id) !== i.user.id) return;

    tickets.delete(i.channel.id);
    confirmClose.delete(i.channel.id);

    await i.channel.send("Zamykanie ticketa...");
    setTimeout(() => i.channel.delete(), 2000);
  }

  if (i.customId === "no_close") {
    confirmClose.delete(i.channel.id);
    return i.update({ content: "Anulowano", components: [] });
  }
});

// ================= SLASH COMMANDS =================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand()) return;

  // USERINFO
  if (i.commandName === "userinfo") {

    const u = i.options.getUser("user");

    return i.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("USER INFO")
          .setColor("#5865F2")
          .setDescription(`User: ${u.tag}\nID: ${u.id}`)
      ]
    });
  }

  // CLEAR
  if (i.commandName === "clear") {

    if (!isOwner(i))
      return i.reply({ ephemeral: true, content: "Brak dostępu" });

    const amount = i.options.getInteger("ilosc");

    const msgs = await i.channel.bulkDelete(amount, true);

    return i.reply({ ephemeral: true, content: `Usunięto ${msgs.size}` });
  }

  // SAY
  if (i.commandName === "say") {

    if (!isOwner(i))
      return i.reply({ ephemeral: true, content: "Brak dostępu" });

    const text = i.options.getString("text");

    await i.reply({ ephemeral: true, content: "Wysłano" });
    return i.channel.send(text);
  }

  // BAN
  if (i.commandName === "ban") {

    if (!isMod(i.member))
      return i.reply({ ephemeral: true, content: "Brak dostępu" });

    const user = i.options.getUser("user");

    await i.guild.members.ban(user.id);

    return i.reply({ ephemeral: true, content: `Zbanowano ${user.tag}` });
  }

  // UNBAN
  if (i.commandName === "unban") {

    if (!isMod(i.member))
      return i.reply({ ephemeral: true, content: "Brak dostępu" });

    const id = i.options.getString("id");

    await i.guild.members.unban(id);

    return i.reply({ ephemeral: true, content: `Unban ${id}` });
  }
});
const cooldown = new Set();

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const allowedMods = [
    MOD_ROLE,
    OWNER_ROLE
  ];

  const member = message.member;
  if (!member) return;

  const hasPerm =
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(OWNER_ROLE) ||
    member.id === OWNER_ID;

  // cooldown 10s na spam w1-w5
  if (cooldown.has(message.author.id)) return;

  const callRole = async (roles, label) => {
    if (!hasPerm) return;

    cooldown.add(message.author.id);
    setTimeout(() => cooldown.delete(message.author.id), 10000);

    const roleMentions = roles.map(r => `<@&${r}>`).join(" ");

    await message.channel.send({
      embeds: [
        {
          title: "🚨 WEZWANIE ADMINISTRACJI",
          color: 0xff3b3b,
          description:
            `**Wywołane przez:** <@${message.author.id}>\n` +
            `**Typ:** ${label}\n\n` +
            `Zespół administracyjny został powiadomiony.`,
          footer: { text: "System powiadomień MOD" }
        }
      ]
    });

    await message.channel.send(roleMentions);
  };

  if (message.content === "!w1")
    return callRole(["1497527981822709840"], "W1 - Niski priorytet");

  if (message.content === "!w2")
    return callRole(
      ["1497527830559588452", "1497527748997157015"],
      "W2 - Średni priorytet"
    );

  if (message.content === "!w3")
    return callRole(
      ["1497527663781351495", "1497527565617729587", "1497527457622790214"],
      "W3 - Wysoki priorytet"
    );

  if (message.content === "!w4")
    return callRole(
      ["1497527300848091288", "1497527197886447656"],
      "W4 - Bardzo wysoki priorytet"
    );

  if (message.content === "!w5")
    return callRole(
      ["1497528458711138406", "1497529283537797130", "1497529477150933023"],
      "W5 - Krytyczny alert"
    );
});
client.login(TOKEN);
