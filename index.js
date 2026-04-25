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

const TOKEN = process.env.TOKEN;

// ================= ROLES =================
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

// ================= DATA =================
const xp = new Map();

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("🏓 Pong"),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎫 ticket panel"),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("📊 twój level"),

  new SlashCommandBuilder()
    .setName("reactionroles")
    .setDescription("🎭 role panel")
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("V4 PRO READY");
});

// ================= PERMISSION =================
function hasPerm(member) {
  return (
    member.roles.cache.has(OWNER_ROLE) ||
    member.roles.cache.has(MOD_ROLE)
  );
}

// ================= LOGS =================
async function log(guild, msg) {
  const ch = guild.channels.cache.find(c => c.name === "logs");
  if (ch) ch.send(`📋 ${msg}`);
}

// ================= WELCOME =================
client.on("guildMemberAdd", member => {
  const channel = member.guild.channels.cache.find(c => c.name === "welcome");
  if (!channel) return;

  channel.send(`👋 Witaj ${member} na serwerze!`);
});

// ================= LEVEL SYSTEM + AUTOMOD =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // XP
  const data = xp.get(message.author.id) || { xp: 0, lvl: 0 };
  data.xp += 5;

  if (data.xp >= 100) {
    data.lvl++;
    data.xp = 0;
    message.channel.send(`📊 ${message.author} level up → ${data.lvl}`);
  }

  xp.set(message.author.id, data);

  const text = message.content.toLowerCase();

  // LINK BLOCK
  if (text.includes("http")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await message.delete();
      return message.channel.send(`🚫 ${message.author} linki są zablokowane`);
    }
  }

  // CAPS BLOCK
  if (message.content.length > 6 && message.content === message.content.toUpperCase()) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send(`⚠️ ${message.author} nie krzycz`);
    }
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  // ================= SLASH =================
  if (interaction.isChatInputCommand()) {

    // PING
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // PANEL
    if (interaction.commandName === "panel") {

      if (!hasPerm(interaction.member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

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

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: "✅ panel wysłany", ephemeral: true });
    }

    // RANK
    if (interaction.commandName === "rank") {
      const d = xp.get(interaction.user.id) || { xp: 0, lvl: 0 };

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📊 Rank")
            .setDescription(`Level: ${d.lvl}\nXP: ${d.xp}/100`)
            .setColor("Blue")
        ]
      });
    }

    // REACTION ROLES PANEL
    if (interaction.commandName === "reactionroles") {

      const embed = new EmbedBuilder()
        .setTitle("🎭 ROLE")
        .setDescription("Kliknij aby dostać role")
        .setColor("Purple");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("role_gamer")
          .setLabel("🎮 Gamer")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }
  }

  // ================= BUTTONS =================
  if (interaction.isButton()) {

    const guild = interaction.guild;

    let cat = guild.channels.cache.find(c => c.name === "🎫・TICKETS");

    if (!cat) {
      cat = await guild.channels.create({
        name: "🎫・TICKETS",
        type: ChannelType.GuildCategory
      });
    }

    // ================= TICKET =================
    if (interaction.customId.startsWith("ticket_")) {

      const ch = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: cat.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
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
        content: `<@&${MOD_ROLE}> <@${interaction.user.id}>`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({ content: "🎫 ticket stworzony", ephemeral: true });
    }

    // CLAIM
    if (interaction.customId === "claim") {
      await interaction.update({
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

      return interaction.channel.send(`🔒 przejęty przez ${interaction.user}`);
    }

    // CLOSE
    if (interaction.customId === "close") {
      await interaction.channel.send("❌ zamykam...");
      setTimeout(() => interaction.channel.delete(), 4000);
    }

    // REACTION ROLE
    if (interaction.customId === "role_gamer") {
      const role = interaction.guild.roles.cache.find(r => r.name === "Gamer");
      const member = interaction.member;

      if (role) {
        member.roles.add(role);
        return interaction.reply({ content: "🎮 dostałeś role Gamer", ephemeral: true });
      }
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
