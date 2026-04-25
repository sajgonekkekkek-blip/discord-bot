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

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== ROLE =====
const OWNER_ROLE = "1497524742868045934";
const MOD_ROLE = "1497541728306204712";

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Ping bota"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Ban usera")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Kick usera")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎫 Panel ticketów")
].map(c => c.toJSON());

// ===== REGISTER SLASHES =====
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Slash commands aktywne");
});

// ===== PERMISSION CHECK =====
function hasPerm(member) {
  return member.roles.cache.has(OWNER_ROLE) || member.roles.cache.has(MOD_ROLE);
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {

  // ================= SLASH COMMANDS =================
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

      const embed = new EmbedBuilder()
        .setTitle("🔨 BAN")
        .setDescription(`${user.tag} został zbanowany`)
        .setColor("Red");

      return interaction.reply({ embeds: [embed] });
    }

    // KICK
    if (interaction.commandName === "kick") {
      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      const user = interaction.options.getUser("user");
      const target = await interaction.guild.members.fetch(user.id);

      await target.kick();

      const embed = new EmbedBuilder()
        .setTitle("👢 KICK")
        .setDescription(`${user.tag} został wyrzucony`)
        .setColor("Orange");

      return interaction.reply({ embeds: [embed] });
    }

    // PANEL
    if (interaction.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setTitle("🎫 TICKET PANEL")
        .setDescription(
          "📜 Regulamin:\n" +
          "• Nie spamuj ticketów\n" +
          "• Opisz problem\n\n" +
          "Wybierz kategorię:"
        )
        .setColor("Blue");

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

      return interaction.reply({ embeds: [embed], components: [row] });
    }
  }

  // ================= TICKETS =================
  if (interaction.isButton()) {

    const guild = interaction.guild;

    // CREATE TICKET
    if (interaction.customId.startsWith("ticket_")) {

      const category = await guild.channels.create({
        name: "🎫 TICKETS",
        type: ChannelType.GuildCategory
      });

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket otwarty")
        .setDescription(
          "👋 Witaj!\n\n" +
          "🧠 Opisz swój problem\n" +
          "⏳ Czekaj na administrację\n\n" +
          "🔥 Nie spamuj"
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

      channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

      return interaction.reply({ content: "🎫 Ticket stworzony", ephemeral: true });
    }

    // CLAIM
    if (interaction.customId === "claim") {
      const embed = new EmbedBuilder()
        .setTitle("🙋 Ticket przejęty")
        .setDescription(`Przejął: ${interaction.user}`)
        .setColor("Yellow");

      return interaction.channel.send({ embeds: [embed] });
    }

    // CLOSE
    if (interaction.customId === "close") {
      await interaction.channel.send("❌ Ticket zamyka się za 5s...");
      setTimeout(() => interaction.channel.delete(), 5000);
    }
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
