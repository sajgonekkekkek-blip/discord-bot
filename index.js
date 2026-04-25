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
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const TOKEN = process.env.TOKEN;

// ================= ROLE =================
const ROLE_OWNER = "1497524742868045934";
const ROLE_MOD = "1497541728306204712";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ================= STATE =================
let ticketID = 0;
const tickets = new Map();
const closeConfirm = new Map();

// ================= ANTI RAID =================
const joinLog = new Map();
const RAID_LIMIT = 5; // ile joinów
const RAID_TIME = 10000; // 10s

// ================= HELPERS =================
const isMod = (m) =>
  m.roles.cache.has(ROLE_MOD) || m.roles.cache.has(ROLE_OWNER);

const isOwner = (m) =>
  m.roles.cache.has(ROLE_OWNER);

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów"),

  new SlashCommandBuilder().setName("userinfo")
    .setDescription("Info o użytkowniku")
    .addUserOption(o =>
      o.setName("user").setDescription("Użytkownik").setRequired(true)
    ),

  new SlashCommandBuilder().setName("clear")
    .setDescription("Czyści czat")
    .addIntegerOption(o =>
      o.setName("ilosc").setDescription("Ilość").setRequired(true)
    ),

  new SlashCommandBuilder().setName("say")
    .setDescription("Bot mówi coś")
    .addStringOption(o =>
      o.setName("tekst").setDescription("Treść").setRequired(true)
    ),

  new SlashCommandBuilder().setName("unban")
    .setDescription("Odbanuj użytkownika")
    .addStringOption(o =>
      o.setName("id").setDescription("ID").setRequired(true)
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

// ================= ANTI RAID =================
client.on("guildMemberAdd", async (member) => {

  const now = Date.now();
  const guild = member.guild;

  if (!joinLog.has(guild.id)) joinLog.set(guild.id, []);

  const logs = joinLog.get(guild.id);

  logs.push(now);

  const recent = logs.filter(t => now - t < RAID_TIME);
  joinLog.set(guild.id, recent);

  if (recent.length >= RAID_LIMIT) {

    const channel = guild.channels.cache.find(c => c.name === "general");

    guild.channels.cache.forEach(c => {
      if (c.permissionsFor(guild.id).has(PermissionsBitField.Flags.SendMessages)) {
        c.permissionOverwrites.edit(guild.id, {
          SendMessages: false
        });
      }
    });

    if (channel) {
      channel.send("⚠ RAID DETECTED — serwer zablokowany");
    }
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand() && !i.isButton()) return;

  // ================= PANEL =================
  if (i.isChatInputCommand() && i.commandName === "panel") {

    if (!isMod(i.member))
      return i.reply({ content:"Brak dostępu", ephemeral:true });

    const embed = new EmbedBuilder()
      .setTitle("🎫 PANEL TICKETÓW")
      .setColor("#5865F2")
      .setDescription("Kliknij aby otworzyć ticket");

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
      .setTitle(`🎫 Ticket #${num}`)
      .setColor("#57F287")
      .setDescription("Opisz problem");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await ch.send({ content:`<@&${ROLE_MOD}>`, embeds:[embed], components:[row] });

    return i.reply({ content:`Ticket ${num}`, ephemeral:true });
  }

  // ================= CLAIM =================
  if (i.isButton() && i.customId === "claim") {

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak uprawnień" });

    tickets.get(i.channel.id).claimed = true;

    return i.update({ components: i.message.components });
  }

  // ================= UNCLAIM =================
  if (i.isButton() && i.customId === "unclaim") {

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak uprawnień" });

    tickets.get(i.channel.id).claimed = false;

    return i.update({ components: i.message.components });
  }

  // ================= CLOSE (CONFIRM SYSTEM) =================
  if (i.isButton() && i.customId === "close") {

    const t = tickets.get(i.channel.id);

    if (isMod(i.member)) {

      closeConfirm.set(i.channel.id, i.user.id);

      return i.reply({
        ephemeral:true,
        content:"Na pewno chcesz zamknąć ticket?",
        components:[
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_close").setLabel("Tak").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("cancel_close").setLabel("Nie").setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    return i.reply({ ephemeral:true, content:"Brak uprawnień" });
  }

  if (i.customId === "confirm_close") {

    const t = tickets.get(i.channel.id);

    tickets.delete(i.channel.id);
    closeConfirm.delete(i.channel.id);

    await i.channel.send("Zamykanie ticketa...");
    setTimeout(()=>i.channel.delete(),2000);
  }

  if (i.customId === "cancel_close") {
    closeConfirm.delete(i.channel.id);
    return i.update({ content:"Anulowano", components:[] });
  }
});

// ================= SLASH COMMANDS =================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand()) return;

  // USERINFO
  if (i.commandName === "userinfo") {

    const u = i.options.getUser("user");

    return i.reply({
      embeds:[
        new EmbedBuilder()
          .setTitle("User Info")
          .setColor("#5865F2")
          .setDescription(`User: ${u.tag}\nID: ${u.id}`)
      ],
      ephemeral:true
    });
  }

  // CLEAR
  if (i.commandName === "clear") {

    if (!isMod(i.member))
      return i.reply({ content:"Brak dostępu", ephemeral:true });

    const amount = i.options.getInteger("ilosc");

    const msgs = await i.channel.bulkDelete(amount, true);

    return i.reply({ content:`Usunięto ${msgs.size}`, ephemeral:true });
  }

  // SAY
  if (i.commandName === "say") {

    const text = i.options.getString("tekst");

    return i.reply({ content:"Wysłano", ephemeral:true })
      .then(() => i.channel.send(text));
  }

  // UNBAN
  if (i.commandName === "unban") {

    if (!isMod(i.member))
      return i.reply({ content:"Brak dostępu", ephemeral:true });

    const id = i.options.getString("id");

    await i.guild.members.unban(id);

    return i.reply({ content:`Unban ${id}`, ephemeral:true });
  }
});

client.login(TOKEN);
