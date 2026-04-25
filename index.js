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

const TOKEN = process.env.TOKEN;

// ================= CONFIG =================
const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";
const CREATE_CHANNEL_ID = "1497611703280734428";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ================= STATE =================
let ticketCounter = 0;
const cooldown = new Map();
const closeConfirm = new Map();
const voiceOwners = new Map();

// ================= PERMS =================
function isMod(member) {
  return (
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(OWNER_ROLE) ||
    member.id === OWNER_ID
  );
}

// ================= SLASH =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Panel ticketów"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Info o użytkowniku")
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
    .setName("say")
    .setDescription("Bot wysyła wiadomość")
    .addStringOption(o =>
      o.setName("text").setDescription("Tekst").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banuje użytkownika")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Odbanuje użytkownika")
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

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ===== SLASH =====
  if (i.isChatInputCommand()) {

    if (i.commandName === "panel") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 PANEL TICKETÓW")
        .setColor("#5865F2")
        .setDescription("Kliknij przycisk aby stworzyć ticket");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_help").setLabel("Pomoc").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_report").setLabel("Report").setStyle(ButtonStyle.Danger)
      );

      return i.reply({ embeds: [embed], components: [row] });
    }

    if (i.commandName === "userinfo") {
      const u = i.options.getUser("user");

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("USER INFO")
            .setColor("#5865F2")
            .setDescription(`Nick: ${u.tag}\nID: ${u.id}`)
        ],
        ephemeral: true
      });
    }

    if (i.commandName === "clear") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak permisji", ephemeral: true });

      const amount = i.options.getInteger("ilosc");
      const deleted = await i.channel.bulkDelete(amount, true);

      return i.reply({ content: `Usunięto ${deleted.size}`, ephemeral: true });
    }

    if (i.commandName === "say") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak permisji", ephemeral: true });

      const text = i.options.getString("text");

      await i.reply({ content: "Wysłano", ephemeral: true });
      return i.channel.send(text);
    }

    if (i.commandName === "ban") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak permisji", ephemeral: true });

      const user = i.options.getUser("user");
      await i.guild.members.ban(user.id);

      return i.reply({ content: "Zbanowany", ephemeral: true });
    }

    if (i.commandName === "unban") {
      if (!isMod(i.member))
        return i.reply({ content: "Brak permisji", ephemeral: true });

      const id = i.options.getString("id");
      await i.guild.members.unban(id);

      return i.reply({ content: "Unban", ephemeral: true });
    }
  }

  // ===== BUTTONS =====
  if (i.isButton()) {

    // ===== TICKET CREATE =====
    if (i.customId === "ticket_help" || i.customId === "ticket_report") {

      ticketCounter++;
      const id = String(ticketCounter).padStart(4, "0");

      const ch = await i.guild.channels.create({
        name: `ticket-${id}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
          { id: MOD_ROLE, allow: ["ViewChannel", "SendMessages"] },
          { id: OWNER_ROLE, allow: ["ViewChannel", "SendMessages"] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle(`TICKET #${id}`)
        .setColor("#57F287")
        .setDescription("Opisz problem");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await ch.send({ content: `<@&${MOD_ROLE}>`, embeds: [embed], components: [row] });

      return i.reply({ content: "Ticket utworzony", ephemeral: true });
    }

    // ===== CLAIM =====
    if (i.customId === "claim") {
      if (!isMod(i.member)) return i.reply({ content: "Brak permisji", ephemeral: true });

      return i.channel.send({
        embeds: [new EmbedBuilder().setColor("Yellow").setDescription(`Przejął: <@${i.user.id}>`)]
      });
    }

    // ===== UNCLAIM =====
    if (i.customId === "unclaim") {
      if (!isMod(i.member)) return i.reply({ content: "Brak permisji", ephemeral: true });

      return i.channel.send({
        embeds: [new EmbedBuilder().setColor("Orange").setDescription("Ticket oddany")]
      });
    }

    // ===== CLOSE =====
    if (i.customId === "close") {
      closeConfirm.set(i.channel.id, i.user.id);

      return i.reply({
        ephemeral: true,
        content: "Na pewno zamknąć?",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("yes_close").setLabel("Tak").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("no_close").setLabel("Nie").setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    if (i.customId === "yes_close") {
      if (closeConfirm.get(i.channel.id) !== i.user.id) return;
      setTimeout(() => i.channel.delete(), 1500);
    }

    if (i.customId === "no_close") {
      return i.update({ content: "Anulowano", components: [] });
    }

    // ===== VOICE PANEL =====
    const [action, channelId] = i.customId.split("_");

    if (voiceOwners.has(channelId)) {
      const owner = voiceOwners.get(channelId);

      if (i.user.id !== owner)
        return i.reply({ content: "Nie Twój kanał", ephemeral: true });

      const channel = i.guild.channels.cache.get(channelId);
      if (!channel) return;

      if (action === "lock") {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: false });
        return i.reply({ content: "Zamknięto", ephemeral: true });
      }

      if (action === "unlock") {
        await channel.permissionOverwrites.edit(i.guild.id, { Connect: true });
        return i.reply({ content: "Otworzono", ephemeral: true });
      }

      if (action === "mute") {
        channel.members.forEach(m => m.voice.setMute(true));
        return i.reply({ content: "Wyciszono", ephemeral: true });
      }

      if (action === "unmute") {
        channel.members.forEach(m => m.voice.setMute(false));
        return i.reply({ content: "Odciszono", ephemeral: true });
      }

      if (action === "delete") {
        voiceOwners.delete(channel.id);
        await channel.delete();
      }
    }
  }
});

// ================= VOICE SYSTEM =================
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (newState.channelId === CREATE_CHANNEL_ID) {

    const member = newState.member;

    const channel = await newState.guild.channels.create({
      name: `Kanał ${member.user.username}`,
      type: 2,
      parent: newState.channel.parent
    });

    voiceOwners.set(channel.id, member.id);
    await member.voice.setChannel(channel);

    const panel = await newState.guild.channels.create({
      name: `panel-${member.user.username}`,
      type: 0,
      parent: newState.channel.parent,
      permissionOverwrites: [
        { id: newState.guild.id, deny: ["ViewChannel"] },
        { id: member.id, allow: ["ViewChannel"] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("Panel kanału")
      .setColor("#5865F2")
      .setDescription("Zarządzaj kanałem");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lock_${channel.id}`).setLabel("🔒").setStyle(2),
      new ButtonBuilder().setCustomId(`unlock_${channel.id}`).setLabel("🔓").setStyle(2),
      new ButtonBuilder().setCustomId(`mute_${channel.id}`).setLabel("🔇").setStyle(2),
      new ButtonBuilder().setCustomId(`unmute_${channel.id}`).setLabel("🔊").setStyle(2),
      new ButtonBuilder().setCustomId(`delete_${channel.id}`).setLabel("❌").setStyle(4)
    );

    await panel.send({ embeds: [embed], components: [row] });
  }

  if (oldState.channelId && voiceOwners.has(oldState.channelId)) {
    const channel = oldState.channel;

    if (channel.members.size === 0) {
      voiceOwners.delete(channel.id);
      channel.delete().catch(()=>{});
    }
  }
});

// ================= W1–W5 =================
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  if (!isMod(m.member)) return;

  const cmd = m.content.toLowerCase();

  const send = roles =>
    m.channel.send(roles.map(r => `<@&${r}>`).join(" "));

  if (cmd === "!w1") send(["1497527981822709840"]);
  if (cmd === "!w2") send(["1497527830559588452","1497527748997157015"]);
  if (cmd === "!w3") send(["1497527663781351495","1497527565617729587","1497527457622790214"]);
  if (cmd === "!w4") send(["1497527300848091288","1497527197886447656"]);
  if (cmd === "!w5") send(["1497528458711138406","1497529283537797130","1497529477150933023"]);
});

client.login(TOKEN);
