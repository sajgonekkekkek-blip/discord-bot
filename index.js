const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

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
const MOD_ROLE = "1497541728306204712";

// wezwania ról
const W_ROLES = {
  w1: ["1497527981822709840"],
  w2: ["1497527830559588452", "1497527748997157015"],
  w3: ["1497527663781351495", "1497527565617729587", "1497527457622790214"],
  w4: ["1497527300848091288", "1497527197886447656"],
  w5: ["1497528458711138406", "1497529283537797130", "1497529477150933023"]
};

// voice system
const voiceOwners = new Map();
const voiceBans = new Map();

// tickets
let ticketCounter = 0;
const tickets = new Map();

// ================= READY =================
client.once("ready", () => {
  console.log("BOT ONLINE");
});

// ================= MOD CHECK =================
function isMod(member) {
  return member.roles.cache.has(MOD_ROLE) || member.id === OWNER_ID;
}

// ================= W COMMANDS =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // wezwania
  if (W_ROLES[message.content]) {
    if (!isMod(message.member)) return;

    const roles = W_ROLES[message.content];

    return message.channel.send({
      content: `🚨 Wezwanie: ${roles.map(r => `<@&${r}>`).join(", ")}`
    });
  }

  // panel ticket
  if (message.content === "panel") {
    if (message.author.id !== OWNER_ID) return;

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🎫 Ticket System")
      .setDescription(
`Ticket System:
System ticketów pozwala kontaktować się ze staffem.

━━━━━━━━━━━━━━━━━━

Tworzenie ticketa:
Kliknij przycisk, bot stworzy prywatny kanał.

━━━━━━━━━━━━━━━━━━

Używanie:
Opisz problem jasno.

━━━━━━━━━━━━━━━━━━

Zamykanie:
Staff zamyka ticket lub użytkownik.

━━━━━━━━━━━━━━━━━━

Zasady:
• brak spamu
• jeden problem = jeden ticket
• szacunek dla staffu`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Utwórz ticket")
        .setStyle(ButtonStyle.Primary)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }
});

// ================= TICKETS =================
client.on("interactionCreate", async (i) => {

  if (!i.isButton()) return;

  // CREATE TICKET
  if (i.customId === "create_ticket") {

    ticketCounter++;

    const channel = await i.guild.channels.create({
      name: `ticket-${ticketCounter}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: i.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: i.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: MOD_ROLE,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    tickets.set(channel.id, {
      owner: i.user.id,
      claimed: false
    });

    const embed = new EmbedBuilder()
      .setColor("#00aaff")
      .setTitle("🎫 Ticket utworzony")
      .setDescription("Opisz problem.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
    );

    channel.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "Ticket utworzony", ephemeral: true });
  }

  const ticket = tickets.get(i.channel.id);
  if (!ticket) return;

  // CLAIM
  if (i.customId === "claim") {
    if (!isMod(i.member)) return i.reply({ content: "Brak dostępu", ephemeral: true });

    ticket.claimed = true;

    i.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setDescription(`🔒 Ticket przejęty przez ${i.user.tag}`)
      ]
    });

    return i.reply({ content: "Claim OK", ephemeral: true });
  }

  // UNCLAIM
  if (i.customId === "unclaim") {
    if (!isMod(i.member)) return i.reply({ content: "Brak dostępu", ephemeral: true });

    ticket.claimed = false;

    i.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Orange")
          .setDescription(`🔓 Ticket oddany przez ${i.user.tag}`)
      ]
    });

    return i.reply({ content: "Unclaim OK", ephemeral: true });
  }

  // CLOSE
  if (i.customId === "close") {

    const confirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_yes").setLabel("Tak").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("close_no").setLabel("Nie").setStyle(ButtonStyle.Secondary)
    );

    return i.reply({
      content: "Na pewno zamknąć ticket?",
      components: [confirm],
      ephemeral: true
    });
  }

  if (i.customId === "close_yes") {

    const owner = ticket.owner;

    const transcript = `Ticket ${i.channel.name} zamknięty`;

    const user = await client.users.fetch(owner);
    user.send(`📄 Transcript:\n${transcript}`).catch(() => {});

    tickets.delete(i.channel.id);
    i.channel.delete();

  }

  if (i.customId === "close_no") {
    return i.reply({ content: "Anulowano", ephemeral: true });
  }
});

// ================= MOD COMMANDS =================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  if (message.content.startsWith("!ban")) {
    if (!isMod(message.member)) return;

    const user = message.mentions.members.first();
    if (!user) return;

    user.ban();
  }

  if (message.content.startsWith("!unban")) {
    if (!isMod(message.member)) return;

    const id = message.content.split(" ")[1];
    message.guild.members.unban(id);
  }

  if (message.content.startsWith("!clear")) {
    if (!isMod(message.member)) return;

    const amount = parseInt(message.content.split(" ")[1]);
    message.channel.bulkDelete(amount);
  }

  if (message.content.startsWith("!info")) {

    const user = message.mentions.users.first();
    const member = await message.guild.members.fetch(user.id);

    const embed = new EmbedBuilder()
      .setColor("#00aaff")
      .setTitle("USER INFO")
      .addFields(
        { name: "Nick", value: user.tag },
        { name: "ID", value: user.id },
        { name: "Role", value: member.roles.cache.map(r => r.name).join(", ") }
      );

    message.channel.send({ embeds: [embed] });
  }
});

// ================= LOGIN =================
client.login(TOKEN);
