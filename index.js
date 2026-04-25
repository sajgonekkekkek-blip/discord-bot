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

// ================= ROLE / OWNER =================
const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";

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

// ================= HELPERS =================
const isOwner = (i) => i.user.id === OWNER_ID;
const isMod = (m) =>
  m.roles.cache.has(MOD_ROLE) || m.roles.cache.has(OWNER_ROLE);

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów"),
  new SlashCommandBuilder().setName("userinfo").setDescription("Info usera")
    .addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder().setName("clear").setDescription("Clear chat")
    .addIntegerOption(o => o.setName("ilosc").setRequired(true)),
  new SlashCommandBuilder().setName("say").setDescription("Bot mówi")
    .addStringOption(o => o.setName("text").setRequired(true)),
  new SlashCommandBuilder().setName("ban").setDescription("Ban user")
    .addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder().setName("unban").setDescription("Unban user")
    .addStringOption(o => o.setName("id").setRequired(true))
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

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  if (!i.isChatInputCommand() && !i.isButton()) return;

  // ================= PANEL (OWNER ONLY) =================
  if (i.isChatInputCommand() && i.commandName === "panel") {

    if (!isOwner(i))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    const embed = new EmbedBuilder()
      .setTitle("🎫 PANEL TICKETÓW")
      .setColor("#5865F2")
      .setDescription("Kliknij aby utworzyć ticket");

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
        { id:MOD_ROLE, allow:["ViewChannel","SendMessages"] },
        { id:OWNER_ROLE, allow:["ViewChannel","SendMessages"] }
      ]
    });

    tickets.set(ch.id,{
      owner:i.user.id,
      claimed:false,
      claimedBy:null
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 TICKET #${num}`)
      .setColor("#57F287")
      .setDescription("Opisz problem");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await ch.send({ content:`<@&${MOD_ROLE}>`, embeds:[embed], components:[row] });

    return i.reply({ ephemeral:true, content:`Ticket ${num}` });
  }

  // ================= CLAIM =================
  if (i.isButton() && i.customId === "claim") {

    const t = tickets.get(i.channel.id);
    if (!t) return;

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak uprawnień" });

    t.claimed = true;
    t.claimedBy = i.user.id;

    await i.update({ components: i.message.components });

    return i.channel.send({
      embeds:[
        new EmbedBuilder()
          .setTitle("📌 Ticket przejęty")
          .setColor("#FEE75C")
          .setDescription(`Przejął: <@${i.user.id}>`)
      ]
    });
  }

  // ================= UNCLAIM =================
  if (i.isButton() && i.customId === "unclaim") {

    const t = tickets.get(i.channel.id);
    if (!t) return;

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak uprawnień" });

    t.claimed = false;
    t.claimedBy = null;

    await i.update({ components: i.message.components });

    return i.channel.send({
      embeds:[
        new EmbedBuilder()
          .setTitle("↩ Ticket oddany")
          .setColor("#FFB02E")
          .setDescription("Ticket wrócił do administracji")
      ]
    });
  }

  // ================= CLOSE CONFIRM =================
  if (i.isButton() && i.customId === "close") {

    const t = tickets.get(i.channel.id);
    if (!t) return;

    const isAdmin = isMod(i.member);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("confirm_close").setLabel("Tak").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("cancel_close").setLabel("Nie").setStyle(ButtonStyle.Secondary)
    );

    return i.reply({
      ephemeral:true,
      content:isAdmin
        ? "Admin: na pewno zamknąć ticket?"
        : "Czy na pewno chcesz zamknąć ticket?",
      components:[row]
    });
  }

  if (i.customId === "confirm_close") {

    tickets.delete(i.channel.id);

    await i.channel.send("Zamykanie...");
    setTimeout(()=>i.channel.delete(),2000);
  }

  if (i.customId === "cancel_close") {
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
      ephemeral:true,
      embeds:[
        new EmbedBuilder()
          .setTitle("USER INFO")
          .setColor("#5865F2")
          .setDescription(`User: ${u.tag}\nID: ${u.id}`)
      ]
    });
  }

  // CLEAR (OWNER ONLY)
  if (i.commandName === "clear") {

    if (!isOwner(i))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    const amount = i.options.getInteger("ilosc");

    const msgs = await i.channel.bulkDelete(amount, true);

    return i.reply({ ephemeral:true, content:`Usunięto ${msgs.size}` });
  }

  // SAY (OWNER ONLY)
  if (i.commandName === "say") {

    if (!isOwner(i))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    const text = i.options.getString("text");

    await i.reply({ ephemeral:true, content:"Wysłano" });
    return i.channel.send(text);
  }

  // BAN (MOD ONLY)
  if (i.commandName === "ban") {

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    const user = i.options.getUser("user");

    await i.guild.members.ban(user.id);

    return i.reply({ ephemeral:true, content:`Zbanowano ${user.tag}` });
  }

  // UNBAN (MOD ONLY)
  if (i.commandName === "unban") {

    if (!isMod(i.member))
      return i.reply({ ephemeral:true, content:"Brak dostępu" });

    const id = i.options.getString("id");

    await i.guild.members.unban(id);

    return i.reply({ ephemeral:true, content:`Unban ${id}` });
  }
});

client.login(TOKEN);
