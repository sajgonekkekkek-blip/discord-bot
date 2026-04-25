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

// ROLE ID
const OWNER_ROLE = "1497524742868045934";
const MOD_ROLE = "1497541728306204712";

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Sprawdza działanie bota"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Ban usera")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Kick usera")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎫 Ticket panel")
].map(c => c.toJSON());

// ================= REGISTER COMMANDS =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  try {
    console.log("Rejestracja slash commands...");

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("Slash commands zarejestrowane!");
  } catch (err) {
    console.log("ERROR SLASH:", err);
  }
});

// ================= PERMISSIONS =================
function hasPerm(member) {
  return (
    member.roles.cache.has(OWNER_ROLE) ||
    member.roles.cache.has(MOD_ROLE)
  );
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
        return interaction.reply({ content: "❌ Brak permisji", ephemeral: true });

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
        return interaction.reply({ content: "❌ Brak permisji", ephemeral: true });

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
        .setTitle("🎫 Ticket System")
        .setDescription(
          "📜 **REGULAMIN**\n" +
          "• Nie spamuj ticketów\n" +
          "• Opisz problem dokładnie\n" +
          "• Czekaj na administrację\n\n" +
          "👇 Wybierz kategorię"
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

  // ===== BUTTONS =====
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
        .setTitle("🎫 Ticket otwarty")
        .setDescription(
          "👋 Witaj!\n\n" +
          "🧠 Opisz swój problem\n" +
          "⏳ Administracja wkrótce odpowie\n\n" +
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

      channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({ content: "🎫 Ticket utworzony!", ephemeral: true });
    }

    // CLAIM
    if (interaction.customId === "claim") {
      return interaction.channel.send(
        `🙋 Ticket przejęty przez ${interaction.user}`
      );
    }

    // CLOSE
    if (interaction.customId === "close") {
      await interaction.channel.send("❌ Zamykam ticket za 5s...");
      setTimeout(() => interaction.channel.delete(), 5000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
