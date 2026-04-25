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

// ================= IDS =================
const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= STATE =================
let ticketCounter = 0;
const cooldown = new Map();
const closeConfirm = new Map();

// ================= PERMS =================
function isMod(member) {
  if (!member) return false;

  return (
    member.roles?.cache?.has(MOD_ROLE) ||
    member.roles?.cache?.has(OWNER_ROLE) ||
    member.id === OWNER_ID
  );
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Info usera")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Czyści chat")
    .addIntegerOption(o =>
      o.setName("ilosc").setDescription("Ilość").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Bot mówi")
    .addStringOption(o =>
      o.setName("text").setDescription("tekst").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user").setDescription("user").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban user")
    .addStringOption(o =>
      o.setName("id").setDescription("ID").setRequired(true)
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

  // ===== SLASH =====
  if (i.isChatInputCommand()) {

    // PANEL
    if (i.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setTitle("🎫 PANEL TICKETÓW")
        .setColor("#5865F2")
        .setDescription(
`SYSTEM TICKETÓW

Kliknij przycisk aby otworzyć ticket.

━━━━━━━━━━━━━━
Opis:
- Pomoc
- Zgłoszenia
- Support

━━━━━━━━━━━━━━
Regulamin:
• brak spamu
• brak nadużyć
• kultura`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_report").setLabel("Report").setStyle(ButtonStyle.Danger)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    // USERINFO
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

    // CLEAR
    if (i.commandName === "clear") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak uprawnień", ephemeral: true });

      const amount = i.options.getInteger("ilosc");

      const deleted = await i.channel.bulkDelete(amount, true);

      return i.reply({
        content: `Usunięto ${deleted.size}`,
        ephemeral: true
      });
    }

    // SAY
    if (i.commandName === "say") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak uprawnień", ephemeral: true });

      const text = i.options.getString("text");

      await i.reply({ content: "wysłano", ephemeral: true });
      return i.channel.send(text);
    }

    // BAN
    if (i.commandName === "ban") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak uprawnień", ephemeral: true });

      const user = i.options.getUser("user");
      await i.guild.members.ban(user.id);

      return i.reply({ content: "zbanowany", ephemeral: true });
    }

    // UNBAN
    if (i.commandName === "unban") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak uprawnień", ephemeral: true });

      const id = i.options.getString("id");
      await i.guild.members.unban(id);

      return i.reply({ content: "unban", ephemeral: true });
    }
  }

  // ===== BUTTONS =====
  if (!i.isButton()) return;

  // CREATE TICKET
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
      .setTitle(`TICKET #${id}`)
      .setColor("#57F287")
      .setDescription("Opisz problem dokładnie");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await ch.send({ content: `<@&${MOD_ROLE}>`, embeds: [embed], components: [row] });

    return i.reply({ content: "ticket stworzony", ephemeral: true });
  }

  // CLAIM
  if (i.customId === "claim") {
    if (!isMod(i.member))
      return i.reply({ content: "brak uprawnień", ephemeral: true });

    return i.channel.send("ticket przejęty");
  }

  // UNCLAIM
  if (i.customId === "unclaim") {
    if (!isMod(i.member))
      return i.reply({ content: "brak uprawnień", ephemeral: true });

    return i.channel.send("ticket oddany");
  }

  // CLOSE
  if (i.customId === "close") {
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

    setTimeout(() => i.channel.delete(), 1500);
  }

  if (i.customId === "no_close") {
    return i.update({ content: "anulowano", components: [] });
  }
});

// ================= W1–W5 =================
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  const member = m.member;
  if (!member) return;

  const c = m.content.toLowerCase();

  const run = async (roles, label) => {

    if (!isMod(member)) return;

    const last = cooldown.get(m.author.id);
    if (last && Date.now() - last < 10000)
      return m.reply("cooldown 10s");

    cooldown.set(m.author.id, Date.now());

    await m.channel.send(`${roles.map(r => `<@&${r}>`).join(" ")}`);
  };

  if (c === "!w1") return run(["1497527981822709840"], "W1");
  if (c === "!w2") return run(["1497527830559588452","1497527748997157015"], "W2");
  if (c === "!w3") return run(["1497527663781351495","1497527565617729587","1497527457622790214"], "W3");
  if (c === "!w4") return run(["1497527300848091288","1497527197886447656"], "W4");
  if (c === "!w5") return run(["1497528458711138406","1497529283537797130","1497529477150933023"], "W5");
});

// ================= LOGIN =================
client.login(TOKEN);
