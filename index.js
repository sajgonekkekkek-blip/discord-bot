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

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;

const OWNER_ROLE = "1497524742868045934";
const MOD_ROLE = "1497541728306204712";

const LOG_CHANNEL_NAME = "logs";
const TICKET_CATEGORY_NAME = "🎫・TICKETS";

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("🏓 Pong"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Ban user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Kick user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("🧹 usuwa wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc").setDescription("Ilość").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("📢 bot embed")
    .addStringOption(o =>
      o.setName("text").setDescription("Tekst").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 info o userze")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎫 ticket panel")
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Slash commands gotowe");
});

// ================= PERMISSIONS =================
function hasPerm(member) {
  return (
    member.roles.cache.has(OWNER_ROLE) ||
    member.roles.cache.has(MOD_ROLE)
  );
}

// ================= LOGS =================
async function log(guild, text) {
  const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
  if (!channel) return;
  channel.send(`📋 ${text}`);
}

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  // ===== SLASH =====
  if (interaction.isChatInputCommand()) {

    const member = interaction.member;

    // PING
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // BAN
    if (interaction.commandName === "ban") {
      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      const user = interaction.options.getUser("user");
      const target = await interaction.guild.members.fetch(user.id);

      await target.ban();

      log(interaction.guild, `Ban: ${user.tag}`);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔨 BAN")
            .setDescription(`${user.tag} został zbanowany`)
            .setColor("Red")
        ]
      });
    }

    // KICK
    if (interaction.commandName === "kick") {
      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      const user = interaction.options.getUser("user");
      const target = await interaction.guild.members.fetch(user.id);

      await target.kick();

      log(interaction.guild, `Kick: ${user.tag}`);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👢 KICK")
            .setDescription(`${user.tag} został wyrzucony`)
            .setColor("Orange")
        ]
      });
    }

    // CLEAR
    if (interaction.commandName === "clear") {
      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      const amount = interaction.options.getInteger("ilosc");

      await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({ content: `🧹 usunięto ${amount} wiadomości`, ephemeral: true });
    }

    // SAY
    if (interaction.commandName === "say") {
      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      const text = interaction.options.getString("text");

      return interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(text)
            .setColor("#5865F2")
        ]
      });
    }

    // USERINFO
    if (interaction.commandName === "userinfo") {
      const user = interaction.options.getUser("user");
      const member = await interaction.guild.members.fetch(user.id);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👤 USER INFO")
            .setDescription(
              `**Nick:** ${user.tag}\n` +
              `**ID:** ${user.id}\n` +
              `**Joined:** ${member.joinedAt}`
            )
            .setColor("Gold")
        ]
      });
    }

    // PANEL
    if (interaction.commandName === "panel") {

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎫 Support Center")
            .setDescription(
              "📜 REGULAMIN:\n" +
              "• Nie spamuj ticketów\n" +
              "• Opisz problem dokładnie\n\n" +
              "Wybierz kategorię:"
            )
            .setColor("#2b2d31")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ticket_support")
              .setLabel("💬 Support")
              .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
              .setCustomId("ticket_report")
              .setLabel("🚨 Report")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    const guild = interaction.guild;

    // CREATE CATEGORY IF NOT EXISTS
    let category = guild.channels.cache.find(c => c.name === TICKET_CATEGORY_NAME);

    if (!category) {
      category = await guild.channels.create({
        name: TICKET_CATEGORY_NAME,
        type: ChannelType.GuildCategory
      });
    }

    // CREATE TICKET
    if (interaction.customId.startsWith("ticket_")) {

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages
            ]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket Opened")
        .setDescription(
          "👋 Witaj!\n\n" +
          "🧠 Opisz swój problem\n" +
          "⏳ Czekaj na administrację\n\n" +
          "🔥 Przyciski:"
        )
        .setColor("Green");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim")
          .setLabel("🙋 Claim")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("close")
          .setLabel("❌ Close")
          .setStyle(ButtonStyle.Danger)
      );

      channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({ content: "🎫 Ticket utworzony!", ephemeral: true });
    }

    // CLAIM
    if (interaction.customId === "claim") {
      return interaction.channel.send(`🙋 Ticket przejęty przez ${interaction.user}`);
    }

    // CLOSE
    if (interaction.customId === "close") {
      await interaction.channel.send("❌ Zamykam ticket...");
      setTimeout(() => interaction.channel.delete(), 5000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
