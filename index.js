const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const axios = require("axios");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const OPENAI_KEY = process.env.OPENAI_KEY;

const AI_CHANNEL_ID = "1497629571275559042";
const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497541728306204712";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= PERMISSIONS =================
function isOwner(i) {
  return i.user.id === OWNER_ID;
}

function isMod(i) {
  return isOwner(i) || i.member.roles.cache.has(MOD_ROLE);
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Czyści wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc").setDescription("Ile wiadomości").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banuje użytkownika")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Odbanowuje użytkownika")
    .addStringOption(o =>
      o.setName("id").setDescription("ID użytkownika").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Bot wysyła wiadomość")
    .addStringOption(o =>
      o.setName("text").setDescription("Treść").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("Informacje o użytkowniku")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Panel systemu (tylko owner)")
].map(c => c.toJSON());

// ================= REGISTER COMMANDS =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// ================= READY =================
client.once("ready", () => {
  console.log("BOT ONLINE");
});

// ================= AI =================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.id !== AI_CHANNEL_ID) return;

  try {

    const res = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Pomocny asystent Discord." },
        { role: "user", content: message.content }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`
      }
    });

    const reply = res.data.choices?.[0]?.message?.content;

    message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("AI")
          .setDescription(reply?.slice(0, 4000) || "Brak odpowiedzi")
      ]
    });

  } catch (e) {
    console.log(e.message);
    message.reply("AI error.");
  }
});

// ================= SLASH HANDLER =================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand()) return;

  // CLEAR
  if (i.commandName === "clear") {
    if (!isMod(i)) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const amount = i.options.getInteger("ilosc");
    const msgs = await i.channel.bulkDelete(amount, true);

    return i.reply({ content: `Usunięto ${msgs.size} wiadomości`, ephemeral: true });
  }

  // BAN
  if (i.commandName === "ban") {
    if (!isMod(i)) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const user = i.options.getUser("user");
    await i.guild.members.ban(user.id);

    return i.reply({ content: `Zbanowano ${user.tag}`, ephemeral: true });
  }

  // UNBAN
  if (i.commandName === "unban") {
    if (!isMod(i)) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const id = i.options.getString("id");
    await i.guild.members.unban(id);

    return i.reply({ content: `Odbanowano ${id}`, ephemeral: true });
  }

  // SAY
  if (i.commandName === "say") {
    if (!isOwner(i)) return i.reply({ content: "Tylko owner", ephemeral: true });

    const text = i.options.getString("text");

    await i.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setDescription(text)
      ]
    });

    return i.reply({ content: "Wysłano", ephemeral: true });
  }

  // INFO
  if (i.commandName === "info") {

    const user = i.options.getUser("user");
    const member = await i.guild.members.fetch(user.id);

    const embed = new EmbedBuilder()
      .setColor("#00aaff")
      .setTitle("INFO USER")
      .addFields(
        { name: "Nick", value: user.tag },
        { name: "ID", value: user.id },
        { name: "Role", value: member.roles.cache.map(r => r.name).join(", ") }
      );

    return i.reply({ embeds: [embed], ephemeral: true });
  }

  // PANEL
  if (i.commandName === "panel") {
    if (!isOwner(i)) return i.reply({ content: "Brak dostępu", ephemeral: true });

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Panel systemu")
          .setColor("#5865F2")
          .setDescription("System aktywny")
      ],
      ephemeral: true
    });
  }
});

// ================= LOGIN =================
client.login(TOKEN);
