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

// ================= ROLE =================
const ROLE_OWNER = "1497524742868045934";
const ROLE_MOD = "1497541728306204712";

// wezwania
const W1 = "1497527981822709840";
const W2 = ["1497527830559588452","1497527748997157015"];
const W3 = ["1497527663781351495","1497527565617729587","1497527457622790214"];
const W4 = ["1497527300848091288","1497527197886447656"];
const W5 = ["1497528458711138406","1497529283537797130","1497529477150933023"];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let ticketID = 0;
const tickets = new Map();
const cooldown = new Map();

// ================= PERMISJE =================
const isMod = (m) =>
  m.roles.cache.has(ROLE_MOD) || m.roles.cache.has(ROLE_OWNER);

const isOwner = (m) =>
  m.roles.cache.has(ROLE_OWNER);

// ================= KOMENDY =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Sprawdź bota"),

  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Informacje o użytkowniku")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Użytkownik")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Usuń wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc")
        .setDescription("Ilość")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Odbanuj użytkownika")
    .addStringOption(o =>
      o.setName("id")
        .setDescription("ID użytkownika")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unbanall")
    .setDescription("Odbanuj wszystkich (MOD+)"),

  new SlashCommandBuilder()
    .setName("banall")
    .setDescription("Zbanuj wszystkich (OWNER)")
].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Bot działa");
});

// ================= MESSAGE =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // WEZWANIA STAFF (TYLKO UNCLAIM)
  if (msg.content.startsWith("!w")) {

    const t = tickets.get(msg.channel.id);

    if (!t)
      return msg.reply("Brak ticketa");

    if (t.claimed)
      return msg.reply("Ticket jest przejęty");

    const cd = cooldown.get(msg.author.id) || 0;
    if (Date.now() - cd < 15000)
      return msg.reply("Cooldown 15s");

    cooldown.set(msg.author.id, Date.now());

    let roles = [];
    if (msg.content === "!w1") roles = [W1];
    if (msg.content === "!w2") roles = W2;
    if (msg.content === "!w3") roles = W3;
    if (msg.content === "!w4") roles = W4;
    if (msg.content === "!w5") roles = W5;

    msg.channel.send({
      content: roles.map(r => `<@&${r}>`).join(" "),
      embeds: [
        new EmbedBuilder()
          .setTitle("🚨 Wezwanie pomocy")
          .setColor("#ED4245")
          .setDescription(`Użytkownik ${msg.author.tag} potrzebuje pomocy`)
      ]
    });
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand()) return;

  // ================= PING =================
  if (i.commandName === "ping")
    return i.reply({ content: "OK", ephemeral: true });

  // ================= PANEL =================
  if (i.commandName === "panel") {

    if (!isMod(i.member))
      return i.reply({ content: "Brak dostępu", ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("SYSTEM TICKETÓW")
      .setColor("#5865F2")
      .setDescription(
`System ticketów

Tworzenie:
- kliknij przycisk

Zasady:
- brak spamu
- jeden problem = jeden ticket

Zamykanie:
- tylko przejęty ticket można zamknąć`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_report").setLabel("Report").setStyle(ButtonStyle.Danger)
    );

    return i.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // ================= USERINFO =================
  if (i.commandName === "userinfo") {

    const u = i.options.getUser("user");
    const m = await i.guild.members.fetch(u.id);

    return i.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("INFO UŻYTKOWNIKA")
          .setColor("#5865F2")
          .setThumbnail(u.displayAvatarURL())
          .setDescription(
`Nick: ${u.tag}
ID: ${u.id}
Konto: ${u.createdAt.toDateString()}
Dołączył: ${m.joinedAt?.toDateString()}`
          )
      ]
    });
  }

  // ================= CLEAR =================
  if (i.commandName === "clear") {

    if (!isMod(i.member))
      return i.reply({ content: "Brak dostępu", ephemeral: true });

    const amount = i.options.getInteger("ilosc");

    const msgs = await i.channel.bulkDelete(amount, true);

    return i.reply({ content: `Usunięto ${msgs.size}`, ephemeral: true });
  }

  // ================= UNBAN =================
  if (i.commandName === "unban") {

    if (!isMod(i.member))
      return i.reply({ content: "Brak dostępu", ephemeral: true });

    const id = i.options.getString("id");

    await i.guild.members.unban(id).catch(()=>{});

    return i.reply({ content: `Odbanowano ${id}`, ephemeral: true });
  }

  // ================= UNBAN ALL =================
  if (i.commandName === "unbanall") {

    if (!isMod(i.member))
      return i.reply({ content: "Brak dostępu", ephemeral: true });

    const bans = await i.guild.bans.fetch();

    for (const b of bans.values()) {
      await i.guild.members.unban(b.user.id).catch(()=>{});
    }

    return i.reply({ content: "Odbanowano wszystkich", ephemeral: true });
  }

  // ================= BAN ALL =================
  if (i.commandName === "banall") {

    if (!isOwner(i.member))
      return i.reply({ content: "Brak dostępu", ephemeral: true });

    const members = await i.guild.members.fetch();

    members.forEach(m => {
      if (!m.user.bot) m.ban().catch(()=>{});
    });

    return i.reply({ content: "Ban all wykonany", ephemeral: true });
  }
});

// ================= BUTTONS =================
client.on("interactionCreate", async (i) => {

  if (!i.isButton()) return;

  const g = i.guild;

  // CREATE TICKET
  if (i.customId.startsWith("ticket")) {

    ticketID++;
    const num = ticketID.toString().padStart(4,"0");

    const ch = await g.channels.create({
      name: `ticket-${num}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: g.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel","SendMessages"] },
        { id: ROLE_MOD, allow: ["ViewChannel","SendMessages"] }
      ]
    });

    tickets.set(ch.id, {
      owner: i.user.id,
      claimed: false,
      num
    });

    const embed = new EmbedBuilder()
      .setTitle(`TICKET #${num}`)
      .setColor("#57F287")
      .setDescription("Opisz problem");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Przejmij").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Oddaj").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
    );

    ch.send({ content: `<@&${ROLE_MOD}> <@${i.user.id}>`, embeds:[embed], components:[row] });

    return i.reply({ content:`Ticket #${num}`, ephemeral:true });
  }

  // CLAIM
  if (i.customId === "claim") {

    const t = tickets.get(i.channel.id);

    if (i.user.id === t.owner && !isOwner(i.member))
      return i.reply({ content:"Nie możesz przejąć swojego ticketu", ephemeral:true });

    t.claimed = true;

    await i.update({
      components:[
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("unclaim").setLabel("Oddaj").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
        )
      ]
    });

    return i.channel.send({
      embeds:[
        new EmbedBuilder()
          .setColor("#F1C40F")
          .setDescription(`Ticket przejęty przez ${i.user.tag}`)
      ]
    });
  }

  // UNCLAIM
  if (i.customId === "unclaim") {

    const t = tickets.get(i.channel.id);
    t.claimed = false;

    await i.update({
      components:[
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("claim").setLabel("Przejmij").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
        )
      ]
    });

    return i.channel.send({
      embeds:[
        new EmbedBuilder()
          .setColor("#3498DB")
          .setDescription(`Ticket oddany przez ${i.user.tag}`)
      ]
    });
  }

  // CLOSE (TYLKO CLAIMED)
  if (i.customId === "close") {

    const t = tickets.get(i.channel.id);

    if (!t.claimed)
      return i.reply({ content:"Ticket musi być przejęty", ephemeral:true });

    tickets.delete(i.channel.id);

    await i.channel.send("Zamykam ticket...");
    setTimeout(()=>i.channel.delete(), 2000);
  }
});

client.login(TOKEN);
