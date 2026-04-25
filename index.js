const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField
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
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const OWNER_ID = "1311750832374419535";

// ================= WEZWANIA =================
const W_ROLES = {
  w1: ["1497527981822709840"],
  w2: ["1497527830559588452", "1497527748997157015"],
  w3: ["1497527663781351495", "1497527565617729587", "1497527457622790214"],
  w4: ["1497527300848091288", "1497527197886447656"],
  w5: ["1497528458711138406", "1497529283537797130", "1497529477150933023"]
};

// ================= READY =================
client.once("ready", () => {
  console.log("BOT ONLINE");
});

// ================= WEZWANIA =================
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  if (W_ROLES[message.content]) {
    return message.channel.send({
      content: `🚨 Wezwanie: ${W_ROLES[message.content]
        .map(r => `<@&${r}>`)
        .join(", ")}`
    });
  }
});

// ================= SLASH COMMANDS =================
const commands = [

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
    .setName("kick")
    .setDescription("Wyrzuca użytkownika")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Czyści wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc").setDescription("Ilość").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout użytkownika")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("czas").setDescription("Czas w sekundach").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Zdejmuje timeout")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("Informacje o użytkowniku")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Bot wysyła wiadomość")
    .addStringOption(o =>
      o.setName("text").setDescription("Tekst").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Panel systemu")
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// ================= HANDLER =================
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  const member = i.member;
  const isOwner = i.user.id === OWNER_ID;
  const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator) || isOwner;

  // BAN
  if (i.commandName === "ban") {
    if (!isAdmin) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const user = i.options.getUser("user");
    await i.guild.members.ban(user.id);

    return i.reply({ content: `Zbanowano ${user.tag}`, ephemeral: true });
  }

  // UNBAN
  if (i.commandName === "unban") {
    if (!isAdmin) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const id = i.options.getString("id");
    await i.guild.members.unban(id);

    return i.reply({ content: `Odbanowano ${id}`, ephemeral: true });
  }

  // KICK
  if (i.commandName === "kick") {
    if (!isAdmin) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const user = i.options.getUser("user");
    const memberToKick = await i.guild.members.fetch(user.id);

    await memberToKick.kick();

    return i.reply({ content: `Wyrzucono ${user.tag}`, ephemeral: true });
  }

  // CLEAR
  if (i.commandName === "clear") {
    if (!isAdmin) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const amount = i.options.getInteger("ilosc");
    await i.channel.bulkDelete(amount, true);

    return i.reply({ content: `Usunięto ${amount} wiadomości`, ephemeral: true });
  }

  // MUTE
  if (i.commandName === "mute") {
    if (!isAdmin) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const user = i.options.getUser("user");
    const time = i.options.getInteger("czas");

    const memberMute = await i.guild.members.fetch(user.id);

    await memberMute.timeout(time * 1000);

    return i.reply({ content: `Wyciszono ${user.tag}`, ephemeral: true });
  }

  // UNMUTE
  if (i.commandName === "unmute") {
    if (!isAdmin) return i.reply({ content: "Brak uprawnień", ephemeral: true });

    const user = i.options.getUser("user");
    const memberMute = await i.guild.members.fetch(user.id);

    await memberMute.timeout(null);

    return i.reply({ content: `Odciszono ${user.tag}`, ephemeral: true });
  }

  // INFO
  if (i.commandName === "info") {
    const user = i.options.getUser("user");
    const memberInfo = await i.guild.members.fetch(user.id);

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#00aaff")
          .setTitle("INFO USER")
          .addFields(
            { name: "Nick", value: user.tag },
            { name: "ID", value: user.id },
            { name: "Role", value: memberInfo.roles.cache.map(r => r.name).join(", ") }
          )
      ],
      ephemeral: true
    });
  }

  // SAY
  if (i.commandName === "say") {
    if (!isOwner) return i.reply({ content: "Tylko owner", ephemeral: true });

    const text = i.options.getString("text");

    await i.channel.send({
      embeds: [new EmbedBuilder().setColor("Green").setDescription(text)]
    });

    return i.reply({ content: "Wysłano", ephemeral: true });
  }

  // PANEL
  if (i.commandName === "panel") {
    if (!isOwner) return i.reply({ content: "Brak dostępu", ephemeral: true });

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Panel systemu")
          .setColor("#5865F2")
          .setDescription("System działa poprawnie")
      ],
      ephemeral: true
    });
  }
});

// ================= LOGIN =================
client.login(TOKEN);
