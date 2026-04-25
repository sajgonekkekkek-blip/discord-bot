const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= CONFIG =================
const PREFIX = "!";
const LOG_CHANNEL_NAME = "logs";
const TICKET_CATEGORY = "TICKETS";
const WELCOME_CHANNEL = "welcome";

// role które mogą używać moderacji
const MOD_ROLE = "Admin";

// ================= READY =================
client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
});

// ================= WELCOME =================
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.find(c => c.name === WELCOME_CHANNEL);
  if (!channel) return;

  channel.send(`👋 Witaj ${member}! Miłej zabawy na serwerze.`);
});

// ================= LOG SYSTEM =================
async function log(guild, text) {
  const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
  if (!channel) return;
  channel.send(`📋 ${text}`);
}

// ================= LEVEL SYSTEM (prosty) =================
const xp = new Map();

function addXP(userId) {
  let data = xp.get(userId) || { xp: 0, lvl: 1 };
  data.xp += 10;

  if (data.xp >= data.lvl * 100) {
    data.lvl++;
    data.xp = 0;
  }

  xp.set(userId, data);
}

// ================= MESSAGE SYSTEM =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  addXP(message.author.id);

  // ===== MOD CHECK =====
  const isMod = message.member.roles.cache.some(r => r.name === MOD_ROLE);

  // ===== PING =====
  if (message.content === PREFIX + "ping") {
    message.reply("Pong!");
  }

  // ===== KICK =====
  if (message.content.startsWith(PREFIX + "kick")) {
    if (!isMod) return message.reply("Brak permisji.");

    const user = message.mentions.members.first();
    if (!user) return message.reply("Podaj usera.");

    user.kick();
    message.reply("Wyrzucono użytkownika.");
    log(message.guild, `Kick: ${user.user.tag}`);
  }

  // ===== BAN =====
  if (message.content.startsWith(PREFIX + "ban")) {
    if (!isMod) return message.reply("Brak permisji.");

    const user = message.mentions.members.first();
    if (!user) return message.reply("Podaj usera.");

    user.ban();
    message.reply("Zbanowano użytkownika.");
    log(message.guild, `Ban: ${user.user.tag}`);
  }

  // ===== LEVEL CHECK =====
  if (message.content === PREFIX + "level") {
    const data = xp.get(message.author.id) || { xp: 0, lvl: 1 };
    message.reply(`Level: ${data.lvl} | XP: ${data.xp}`);
  }

  // ===== PANEL TICKETS =====
  if (message.content === PREFIX + "panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket Panel")
      .setDescription("Wybierz kategorię ticketu")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("support")
        .setLabel("Support")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("report")
        .setLabel("Report")
        .setStyle(ButtonStyle.Danger)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// ================= TICKETS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;

  // CREATE TICKET
  if (interaction.customId === "support" || interaction.customId === "report") {
    let category = guild.channels.cache.find(c => c.name === TICKET_CATEGORY);

    if (!category) {
      category = await guild.channels.create({
        name: TICKET_CATEGORY,
        type: ChannelType.GuildCategory
      });
    }

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger)
    );

    channel.send({ content: `Ticket od ${interaction.user}`, components: [row] });

    interaction.reply({ content: "Ticket utworzony!", ephemeral: true });
  }

  // CLAIM
  if (interaction.customId === "claim") {
    interaction.channel.send(`🎯 Ticket przejęty przez ${interaction.user}`);
  }

  // CLOSE
  if (interaction.customId === "close") {
    interaction.channel.delete();
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
