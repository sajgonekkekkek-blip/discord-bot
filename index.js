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

// ================= SIMPLE XP SYSTEM =================
const xp = new Map();

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("🏓 Pong"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 ban user")
    .addUserOption(o => o.setName("user").setDescription("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 kick user")
    .addUserOption(o => o.setName("user").setDescription("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("🧹 clear messages")
    .addIntegerOption(o => o.setName("ilosc").setRequired(true)),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎫 ticket panel"),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("📊 twój poziom")
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("READY V3 PRO");
});

// ================= PERMISSIONS =================
function hasPerm(member) {
  return (
    member.roles.cache.has(OWNER_ROLE) ||
    member.roles.cache.has(MOD_ROLE)
  );
}

// ================= LOG CHANNEL =================
async function log(guild, text) {
  const channel = guild.channels.cache.find(c => c.name === "logs");
  if (channel) channel.send(`📋 ${text}`);
}

// ================= XP SYSTEM =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const id = message.author.id;
  const data = xp.get(id) || { xp: 0, lvl: 0 };

  data.xp += 5;

  if (data.xp >= 100) {
    data.lvl++;
    data.xp = 0;

    message.channel.send(`📊 ${message.author} awansował na lvl ${data.lvl}`);
  }

  xp.set(id, data);

  // ================= AUTOMOD =================
  const msg = message.content.toLowerCase();

  if (/(https?:\/\/)/.test(msg)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await message.delete();
      return message.channel.send(`🚫 ${message.author} linki są zablokowane`);
    }
  }

  if (msg === msg.toUpperCase() && msg.length > 6) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send(`⚠️ ${message.author} nie krzycz`);
    }
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  // ================= SLASH =================
  if (interaction.isChatInputCommand()) {

    const member = interaction.member;

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

      return interaction.reply(`🔨 zbanowano ${user.tag}`);
    }

    // KICK
    if (interaction.commandName === "kick") {
      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      const user = interaction.options.getUser("user");
      const target = await interaction.guild.members.fetch(user.id);

      await target.kick();

      log(interaction.guild, `Kick: ${user.tag}`);

      return interaction.reply(`👢 wyrzucono ${user.tag}`);
    }

    // CLEAR
    if (interaction.commandName === "clear") {
      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      const amount = interaction.options.getInteger("ilosc");

      await interaction.channel.bulkDelete(amount);

      return interaction.reply({ content: `🧹 usunięto ${amount}`, ephemeral: true });
    }

    // PANEL
    if (interaction.commandName === "panel") {

      if (!hasPerm(member))
        return interaction.reply({ content: "❌ brak permisji", ephemeral: true });

      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setDescription(
          "System ticketów pozwala kontaktować się z administracją.\n\n" +
          "Kliknij przycisk aby stworzyć prywatny kanał."
        )
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

      return interaction.editReply("✅ panel wysłany");
    }

    // RANK
    if (interaction.commandName === "rank") {
      const data = xp.get(interaction.user.id) || { xp: 0, lvl: 0 };

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📊 Twój poziom")
            .setDescription(`Level: ${data.lvl}\nXP: ${data.xp}/100`)
            .setColor("Blue")
        ]
      });
    }
  }

  // ================= BUTTONS =================
  if (interaction.isButton()) {

    const guild = interaction.guild;

    let category = guild.channels.cache.find(c => c.name === "🎫・TICKETS");

    if (!category) {
      category = await guild.channels.create({
        name: "🎫・TICKETS",
        type: ChannelType.GuildCategory
      });
    }

    // ================= TICKET CREATE =================
    if (interaction.customId.startsWith("ticket_")) {

      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: MOD_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("🎫 TICKET OPENED")
        .setDescription(
          "📌 Status: OPEN\n" +
          "🔔 Staff powiadomiony\n\n" +
          "Opisz problem dokładnie."
        )
        .setColor("#57F287");

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

      channel.send({
        content: `<@&${MOD_ROLE}> <@${interaction.user.id}>`,
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({ content: "🎫 ticket stworzony", ephemeral: true });
    }

    // ================= CLAIM =================
    if (interaction.customId === "claim") {

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

      return interaction.channel.send(`🔒 ticket przejęty przez ${interaction.user}`);
    }

    // ================= CLOSE =================
    if (interaction.customId === "close") {

      await interaction.channel.send("❌ zamykanie ticketu...");

      setTimeout(() => interaction.channel.delete(), 4000);
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
