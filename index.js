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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("🏓 Pong"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Ban user")
    .addUserOption(o => o.setName("user").setDescription("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Kick user")
    .addUserOption(o => o.setName("user").setDescription("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("🧹 clear messages")
    .addIntegerOption(o => o.setName("ilosc").setDescription("ile").setRequired(true)),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("📢 bot message")
    .addStringOption(o => o.setName("text").setDescription("text").setRequired(true)),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 user info")
    .addUserOption(o => o.setName("user").setDescription("user").setRequired(true)),

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

  console.log("Slash commands READY");
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

  // ================= SLASH =================
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
              `Nick: ${user.tag}\nID: ${user.id}\nJoined: ${member.joinedAt}`
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
            .setTitle("🎫 SUPPORT CENTER")
            .setDescription(
              "📜 REGULAMIN TICKETÓW:\n" +
              "• Nie spamuj\n" +
              "• Opisz problem dokładnie\n" +
              "• Szanuj administrację\n\n" +
              "Wybierz kategorię:"
            )
            .setColor("#2b2d31")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ticket_support")
              .setLabel("💬 Support")
              .setEmoji("💬")
              .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
              .setCustomId("ticket_report")
              .setLabel("🚨 Report")
              .setEmoji("🚨")
              .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
              .setCustomId("ticket_other")
              .setLabel("❓ Other")
              .setEmoji("❓")
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }
  }

  // ================= BUTTONS =================
  if (interaction.isButton()) {

    const guild = interaction.guild;

    // CREATE CATEGORY
    let category = guild.channels.cache.find(c => c.name === "🎫・TICKETS");

    if (!category) {
      category = await guild.channels.create({
        name: "🎫・TICKETS",
        type: ChannelType.GuildCategory
      });
    }

    // ================= CREATE TICKET =================
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
          },
          {
            id: MOD_ROLE,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages
            ]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("🎫 TICKET OPENED")
        .setDescription(
          "👋 Witaj w systemie wsparcia!\n\n" +
          "📌 Status: 🟢 Open\n" +
          "🔔 Administracja została powiadomiona\n\n" +
          "📜 Instrukcje:\n" +
          "• Opisz problem\n" +
          "• Nie spamuj\n\n" +
          "━━━━━━━━━━━━━━━━━━━━━━"
        )
        .setColor("#57F287");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim")
          .setLabel("🔓 Claim")
          .setEmoji("🔓")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("close")
          .setLabel("❌ Close")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      );

      channel.send({
        content: `<@&${MOD_ROLE}> <@${interaction.user.id}>`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({ content: "🎫 Ticket utworzony!", ephemeral: true });
    }

    // ================= CLAIM =================
    if (interaction.customId === "claim") {

      const embed = new EmbedBuilder()
        .setTitle("🔒 TICKET PRZEJĘTY")
        .setDescription(
          `🔒 Status: CLAIMED\n` +
          `👮 Moderator: ${interaction.user.tag}`
        )
        .setColor("#FEE75C");

      await interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("claimed")
              .setLabel("🔒 Przejęty")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),

            new ButtonBuilder()
              .setCustomId("close")
              .setLabel("❌ Close")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });

      return interaction.channel.send({ embeds: [embed] });
    }

    // ================= CLOSE =================
    if (interaction.customId === "close") {

      await interaction.channel.send("❌ Ticket zamykany...");

      setTimeout(() => interaction.channel.delete(), 5000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
