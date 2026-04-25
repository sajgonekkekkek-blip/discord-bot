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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= ROLES =================
const OWNER_ROLE = "1497524742868045934";
const MOD_ROLE = "1497541728306204712";

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Sprawdza działanie bota"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Banuje użytkownika")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Wyrzuca użytkownika")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎫 Otwiera panel ticketów")
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );
});

// ================= PERMISSION CHECK =================
function isAllowed(member) {
  return (
    member.roles.cache.has(OWNER_ROLE) ||
    member.roles.cache.has(MOD_ROLE)
  );
}

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;

  // ================= PING =================
  if (interaction.commandName === "ping") {
    return interaction.reply("🏓 Pong! Bot działa stabilnie.");
  }

  // ================= BAN =================
  if (interaction.commandName === "ban") {
    if (!isAllowed(member))
      return interaction.reply({ content: "❌ Brak permisji", ephemeral: true });

    const user = interaction.options.getUser("user");
    const target = await interaction.guild.members.fetch(user.id);

    await target.ban();

    const embed = new EmbedBuilder()
      .setTitle("🔨 Ban wykonany")
      .setDescription(`Użytkownik ${user.tag} został zbanowany.`)
      .setColor("Red")
      .setFooter({ text: "System moderacji" });

    interaction.reply({ embeds: [embed] });
  }

  // ================= KICK =================
  if (interaction.commandName === "kick") {
    if (!isAllowed(member))
      return interaction.reply({ content: "❌ Brak permisji", ephemeral: true });

    const user = interaction.options.getUser("user");
    const target = await interaction.guild.members.fetch(user.id);

    await target.kick();

    const embed = new EmbedBuilder()
      .setTitle("👢 Kick wykonany")
      .setDescription(`Użytkownik ${user.tag} został wyrzucony.`)
      .setColor("Orange");

    interaction.reply({ embeds: [embed] });
  }

  // ================= PANEL =================
  if (interaction.commandName === "panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket Center")
      .setDescription(
        "📜 **REGULAMIN TICKETÓW**\n\n" +
        "• Nie twórz spam ticketów\n" +
        "• Opisz dokładnie problem\n" +
        "• Nie pinguj administracji bez powodu\n\n" +
        "👇 Wybierz kategorię aby otworzyć ticket"
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

    interaction.reply({ embeds: [embed], components: [row] });
  }
});

// ================= TICKETS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;

  // ================= CREATE TICKET =================
  if (interaction.customId.startsWith("ticket_")) {

    const category = await guild.channels.create({
      name: "🎫・TICKETS",
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
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket utworzony")
      .setDescription(
        "👋 Witaj w swoim tickecie!\n\n" +
        "📌 Opisz dokładnie problem\n" +
        "⏳ Administracja zaraz się tobą zajmie\n\n" +
        "⚡ Nie spamuj i czekaj cierpliwie"
      )
      .setColor("Green");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("🙋 Claim")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("❌ Close")
        .setStyle(ButtonStyle.Danger)
    );

    channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

    return interaction.reply({ content: "🎫 Ticket utworzony!", ephemeral: true });
  }

  // ================= CLAIM =================
  if (interaction.customId === "claim_ticket") {

    const embed = new EmbedBuilder()
      .setTitle("🙋 Ticket przejęty")
      .setDescription(`Ticket został przejęty przez ${interaction.user}`)
      .setColor("Yellow");

    interaction.channel.send({ embeds: [embed] });
  }

  // ================= CLOSE =================
  if (interaction.customId === "close_ticket") {

    const embed = new EmbedBuilder()
      .setTitle("❌ Ticket zamknięty")
      .setDescription("Ticket zostanie usunięty za 5 sekund...")
      .setColor("Red");

    await interaction.channel.send({ embeds: [embed] });

    setTimeout(() => {
      interaction.channel.delete();
    }, 5000);
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
