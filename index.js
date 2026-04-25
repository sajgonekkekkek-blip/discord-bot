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

// wezwania staff
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

// ================= STATE =================
let ticketID = 0;
const tickets = new Map();
const cooldown = new Map();
const pendingClose = new Map();

// ================= PERMISSIONS =================
const isMod = (m) =>
  m.roles.cache.has(ROLE_MOD) || m.roles.cache.has(ROLE_OWNER);

const isOwner = (m) =>
  m.roles.cache.has(ROLE_OWNER);

// ================= TRANSCRIPT =================
async function generateTranscript(channel) {

  const msgs = await channel.messages.fetch({ limit: 100 });
  const sorted = [...msgs.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp);

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
  <h2>Transcript: ${channel.name}</h2>
  `;

  for (const m of sorted) {
    html += `
      <div class="msg">
        <div class="a">${m.author.tag}</div>
        <div class="t">${new Date(m.createdTimestamp).toLocaleString()}</div>
        <div>${m.content || "[embed]"}</div>
      </div>
    `;
  }

  html += "</body></html>";

  const file = path.join(__dirname, `transcript-${channel.id}.html`);
  fs.writeFileSync(file, html);

  return file;
}

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Ping bota"),

  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Informacje o użytkowniku")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Usuń wiadomości")
    .addIntegerOption(o =>
      o.setName("ilosc").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban")
    .addStringOption(o =>
      o.setName("id").setRequired(true)
    ),

  new SlashCommandBuilder().setName("unbanall").setDescription("Unban all"),
  new SlashCommandBuilder().setName("banall").setDescription("Ban all")
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

  if (msg.content.startsWith("!w")) {

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
          .setTitle("Wezwanie administracji")
          .setColor("#ED4245")
          .setDescription(`${msg.author.tag}`)
      ]
    });
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ================= SLASH =================
  if (i.isChatInputCommand()) {

    if (i.commandName === "ping")
      return i.reply({ content:"OK", ephemeral:true });

    if (i.commandName === "panel") {

      if (!isMod(i.member))
        return i.reply({ content:"Brak dostępu", ephemeral:true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 PANEL TICKETÓW")
        .setColor("#5865F2")
        .setDescription(
`System ticketów:

Tworzenie:
Kliknij przycisk poniżej

━━━━━━━━━━━━━━

Zasady:
• brak spamu
• jeden problem = jeden ticket
• szanuj administrację`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_report").setLabel("Zgłoszenie").setStyle(ButtonStyle.Danger)
      );

      return i.reply({ embeds:[embed], components:[row], ephemeral:false });
    }

    if (i.commandName === "userinfo") {

      const u = i.options.getUser("user");
      const m = await i.guild.members.fetch(u.id);

      return i.reply({
        ephemeral:true,
        embeds:[
          new EmbedBuilder()
            .setTitle("INFO USERA")
            .setColor("#5865F2")
            .setDescription(
`Nick: ${u.tag}
ID: ${u.id}
Konto: ${u.createdAt.toDateString()}
Dołączył: ${m.joinedAt?.toDateString()}`
            )
        ]
      });
    }

    if (i.commandName === "clear") {

      if (!isMod(i.member))
        return i.reply({ content:"Brak dostępu", ephemeral:true });

      const amount = i.options.getInteger("ilosc");
      const msgs = await i.channel.bulkDelete(amount, true);

      return i.reply({ content:`Usunięto ${msgs.size}`, ephemeral:true });
    }

    if (i.commandName === "unban") {

      if (!isMod(i.member))
        return i.reply({ content:"Brak dostępu", ephemeral:true });

      const id = i.options.getString("id");
      await i.guild.members.unban(id).catch(()=>{});

      return i.reply({ content:"Unban wykonany", ephemeral:true });
    }

    if (i.commandName === "unbanall") {

      if (!isMod(i.member))
        return i.reply({ content:"Brak dostępu", ephemeral:true });

      const bans = await i.guild.bans.fetch();
      for (const b of bans.values())
        await i.guild.members.unban(b.user.id).catch(()=>{});

      return i.reply({ content:"Unban all", ephemeral:true });
    }

    if (i.commandName === "banall") {

      if (!isOwner(i.member))
        return i.reply({ content:"Brak dostępu", ephemeral:true });

      const members = await i.guild.members.fetch();
      members.forEach(m => {
        if (!m.user.bot) m.ban().catch(()=>{});
      });

      return i.reply({ content:"Ban all", ephemeral:true });
    }
  }

  // ================= BUTTONS =================
  if (!i.isButton()) return;

  const t = tickets.get(i.channel.id);

  // ================= CREATE TICKET =================
  if (i.customId === "ticket_help" || i.customId === "ticket_report") {

    ticketID++;
    const num = ticketID.toString().padStart(4,"0");

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
      claimed:false,
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

    ch.send({
      content:`<@&${ROLE_MOD}> <@&${ROLE_OWNER}> <@${i.user.id}>`,
      embeds:[embed],
      components:[row]
    });

    return i.reply({ content:`Ticket #${num}`, ephemeral:true });
  }

  // ================= CLAIM =================
  if (i.customId === "claim") {

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    t.claimed = true;

    return i.update({
      components:[
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("unclaim").setLabel("Oddaj").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
        )
      ]
    });
  }

  // ================= UNCLAIM =================
  if (i.customId === "unclaim") {

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    t.claimed = false;

    return i.update({
      components:[
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("claim").setLabel("Przejmij").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("close").setLabel("Zamknij").setStyle(ButtonStyle.Danger)
        )
      ]
    });
  }

  // ================= CLOSE (2 STEP USER + MOD) =================
  if (i.customId === "close") {

    if (isMod(i.member)) {

      if (!t.claimed)
        return i.reply({ ephemeral:true, content:"Najpierw przejmij" });

      const file = await generateTranscript(i.channel);

      const owner = await client.users.fetch(t.owner).catch(()=>null);
      if (owner) {
        owner.send({
          content:"Twój transcript:",
          files:[file]
        }).catch(()=>{});
      }

      tickets.delete(i.channel.id);

      await i.channel.send("Zamykam...");
      return setTimeout(()=>i.channel.delete(),2000);
    }

    pendingClose.set(i.channel.id,i.user.id);

    return i.reply({
      ephemeral:true,
      content:"Na pewno?",
      components:[
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("close_yes").setLabel("Tak").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("close_no").setLabel("Nie").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  if (i.customId === "close_yes") {

    if (pendingClose.get(i.channel.id) !== i.user.id)
      return;

    const file = await generateTranscript(i.channel);

    const t = tickets.get(i.channel.id);

    const owner = await client.users.fetch(t.owner).catch(()=>null);
    if (owner) {
      owner.send({
        content:"Twój transcript:",
        files:[file]
      }).catch(()=>{});
    }

    tickets.delete(i.channel.id);
    pendingClose.delete(i.channel.id);

    await i.channel.send("Zamykam...");
    setTimeout(()=>i.channel.delete(),2000);
  }

  if (i.customId === "close_no") {
    pendingClose.delete(i.channel.id);
    return i.update({ content:"Anulowano", components:[] });
  }
});

client.login(TOKEN);
