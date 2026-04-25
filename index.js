const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TOKEN;

// ================= ROLE =================
const ROLE_OWNER = "1497524742868045934";
const ROLE_MOD = "1497541728306204712";

// staff calls
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

// ================= SAFE STATE =================
let ticketID = 0;
const tickets = new Map();
const cooldown = new Map();
const pendingClose = new Map();

// ================= SAFE FUNCTIONS =================
const safeText = (t) => typeof t === "string" ? t : "Brak danych";

const isMod = (m) =>
  m.roles.cache.has(ROLE_MOD) || m.roles.cache.has(ROLE_OWNER);

const isOwner = (m) =>
  m.roles.cache.has(ROLE_OWNER);

// ================= TRANSCRIPT =================
async function transcript(channel) {

  const msgs = await channel.messages.fetch({ limit: 50 });
  const sorted = [...msgs.values()].reverse();

  let html = `
<html>
<head>
<meta charset="utf-8">
<title>Transcript</title>
<style>
body{background:#2b2d31;color:white;font-family:Arial;padding:20px}
.msg{background:#313338;margin:10px 0;padding:10px;border-radius:8px}
.a{color:#5865F2;font-weight:bold}
.t{font-size:11px;color:#aaa}
</style>
</head>
<body>
<h2>${channel.name}</h2>
`;

  for (const m of sorted) {
    html += `
<div class="msg">
<div class="a">${safeText(m.author?.tag)}</div>
<div class="t">${new Date(m.createdTimestamp).toLocaleString()}</div>
<div>${safeText(m.content)}</div>
</div>`;
  }

  html += "</body></html>";

  const file = path.join(__dirname, `transcript-${channel.id}.html`);
  fs.writeFileSync(file, html);

  return file;
}

// ================= COMMANDS (SAFE - NO UNDEFINED) =================
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ping bota"),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Panel ticketów"),

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
    .setDescription("Czyści wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc")
        .setDescription("Ilość")
        .setRequired(true)
    )

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("BOT ONLINE");
});

// ================= MESSAGE (WEZWANIA) =================
client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  if (!msg.content.startsWith("!w")) return;

  const t = tickets.get(msg.channel.id);
  if (!t) return;

  if (!isMod(msg.member))
    return msg.reply("Brak uprawnień");

  if (t.claimed)
    return msg.reply("Ticket przejęty");

  const cd = cooldown.get(msg.author.id) || 0;
  if (Date.now() - cd < 15000)
    return msg.reply("Cooldown");

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
        .setTitle("Wezwanie")
        .setColor("#ED4245")
        .setDescription(msg.author.tag)
    ]
  });
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand() && !i.isButton()) return;

  // ================= PANEL =================
  if (i.isChatInputCommand() && i.commandName === "panel") {

    if (!isMod(i.member))
      return i.reply({ content:"Brak dostępu", ephemeral:true });

    const embed = new EmbedBuilder()
      .setTitle("PANEL TICKETÓW")
      .setColor("#5865F2")
      .setDescription("Kliknij przycisk aby otworzyć ticket");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_report").setLabel("Zgłoszenie").setStyle(ButtonStyle.Danger)
    );

    return i.reply({ embeds:[embed], components:[row] });
  }

  // ================= CREATE TICKET =================
  if (i.isButton() && (i.customId === "ticket_help" || i.customId === "ticket_report")) {

    ticketID++;
    const num = String(ticketID).padStart(4,"0");

    const ch = await i.guild.channels.create({
      name:`ticket-${num}`,
      type:ChannelType.GuildText,
      permissionOverwrites:[
        { id:i.guild.id, deny:["ViewChannel"] },
        { id:i.user.id, allow:["ViewChannel","SendMessages"] },
        { id:ROLE_MOD, allow:["ViewChannel","SendMessages"] },
        { id:ROLE_OWNER, allow:["ViewChannel","SendMessages"] }
      ]
    });

    tickets.set(ch.id,{
      owner:i.user.id,
      claimed:false
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

    await ch.send({ embeds:[embed], components:[row] });

    return i.reply({ content:`Ticket ${num}`, ephemeral:true });
  }

  // ================= CLAIM =================
  if (i.isButton() && i.customId === "claim") {

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    tickets.get(i.channel.id).claimed = true;

    return i.update({ components:[] });
  }

  // ================= CLOSE =================
  if (i.isButton() && i.customId === "close") {

    const t = tickets.get(i.channel.id);

    if (isMod(i.member)) {

      const file = await transcript(i.channel);

      const u = await client.users.fetch(t.owner).catch(()=>null);
      if (u) u.send({ files:[file] });

      tickets.delete(i.channel.id);

      await i.channel.send("Zamykam...");
      return setTimeout(()=>i.channel.delete(),2000);
    }

    pendingClose.set(i.channel.id, i.user.id);

    return i.reply({
      ephemeral:true,
      content:"Na pewno?",
      components:[
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("yes").setLabel("Tak").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("no").setLabel("Nie").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  if (i.customId === "yes") {

    const t = tickets.get(i.channel.id);

    if (pendingClose.get(i.channel.id) !== i.user.id)
      return;

    const file = await transcript(i.channel);

    const u = await client.users.fetch(t.owner).catch(()=>null);
    if (u) u.send({ files:[file] });

    tickets.delete(i.channel.id);
    pendingClose.delete(i.channel.id);

    await i.channel.send("Zamykam...");
    setTimeout(()=>i.channel.delete(),2000);
  }

  if (i.customId === "no") {
    pendingClose.delete(i.channel.id);
    return i.update({ content:"Anulowano", components:[] });
  }
});

client.login(TOKEN);
