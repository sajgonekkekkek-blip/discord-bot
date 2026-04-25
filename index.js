const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const axios = require("axios");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;

const AI_CHANNEL_ID = "1497629571275559042";
const CREATE_CHANNEL_ID = "1497611703280734428";
const VOICE_CATEGORY_ID = "1497524528060956723";

const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";
const OWNER_ID = "1311750832374419535";

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
const voiceOwners = new Map();
const voiceBans = new Map();
const voicePanels = new Map();

// ================= FILTER =================
const BAD_WORDS = ["kurwa","chuj","jeb","pierd","fuck","shit"];

function isBad(text) {
  return BAD_WORDS.some(w => text.toLowerCase().includes(w));
}

function isMod(member) {
  return (
    member.roles.cache.has(MOD_ROLE) ||
    member.roles.cache.has(OWNER_ROLE) ||
    member.id === OWNER_ID
  );
}

// ================= READY =================
client.once("ready", async () => {
  console.log("BOT ONLINE");

  const ch = await client.channels.fetch(AI_CHANNEL_ID).catch(()=>null);

  if (ch) {
    ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🤖 SYSTEM AI + VOICE + TICKETS")
          .setColor("#00AEEF")
          .setDescription("System działa 24/7")
      ]
    });
  }

  // instrukcja co 2h
  setInterval(async () => {
    const c = await client.channels.fetch(AI_CHANNEL_ID).catch(()=>null);
    if (!c) return;

    c.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📘 Instrukcja AI")
          .setColor("#2ECC71")
          .setDescription("Pisz pytania normalnie. Bez spamu.")
      ]
    }).catch(()=>{});
  }, 2 * 60 * 60 * 1000);
});

// ================= VOICE SYSTEM =================
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (newState.channelId === CREATE_CHANNEL_ID) {

    const m = newState.member;

    const voice = await newState.guild.channels.create({
      name: `kanał-${m.user.username}`,
      type: ChannelType.GuildVoice,
      parent: VOICE_CATEGORY_ID
    });

    const panel = await newState.guild.channels.create({
      name: `panel-${m.user.username}`,
      type: ChannelType.GuildText,
      parent: VOICE_CATEGORY_ID,
      permissionOverwrites: [
        { id: newState.guild.id, deny: ["ViewChannel"] },
        { id: m.id, allow: ["ViewChannel","SendMessages"] }
      ]
    });

    voiceOwners.set(voice.id, m.id);
    voiceBans.set(voice.id, new Set());

    await m.voice.setChannel(voice);

    const embed = new EmbedBuilder()
      .setTitle("🎛️ PANEL KANAŁU")
      .setColor("#5865F2")
      .setDescription("Zarządzanie kanałem");

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lock_${voice.id}`).setLabel("Zamknij").setStyle(2),
      new ButtonBuilder().setCustomId(`unlock_${voice.id}`).setLabel("Otwórz").setStyle(2),
      new ButtonBuilder().setCustomId(`rename_${voice.id}`).setLabel("Rename").setStyle(1)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`kick_${voice.id}`).setLabel("Kick").setStyle(2),
      new ButtonBuilder().setCustomId(`ban_${voice.id}`).setLabel("Ban").setStyle(4),
      new ButtonBuilder().setCustomId(`unban_${voice.id}`).setLabel("Unban").setStyle(3),
      new ButtonBuilder().setCustomId(`delete_${voice.id}`).setLabel("Delete").setStyle(4)
    );

    panel.send({ embeds: [embed], components: [row1,row2] });
  }

  // auto delete
  if (oldState.channelId && voiceOwners.has(oldState.channelId)) {

    const ch = oldState.channel;

    if (ch && ch.members.size === 0) {

      setTimeout(async () => {

        const c = oldState.guild.channels.cache.get(oldState.channelId);
        if (!c || c.members.size > 0) return;

        const panelId = voicePanels.get(oldState.channelId);
        const panel = oldState.guild.channels.cache.get(panelId);

        if (panel) panel.delete().catch(()=>{});

        voiceOwners.delete(oldState.channelId);
        voiceBans.delete(oldState.channelId);
        voicePanels.delete(oldState.channelId);

        c.delete().catch(()=>{});

      }, 60000);
    }
  }
});

// ================= AI =================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.id !== AI_CHANNEL_ID) return;

  const text = message.content;

  if (isBad(text)) {
    await message.delete().catch(()=>{});
    return;
  }

  if (!OPENAI_KEY) return;

  try {

    const res = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Jesteś pomocnym AI." },
        { role: "user", content: text }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`
      }
    });

    const reply = res.data.choices[0].message.content;

    message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#00AEEF")
          .setTitle("🤖 AI")
          .setDescription(reply.slice(0,4000))
      ]
    });

  } catch (e) {
    console.log(e?.response?.data || e.message);
    message.reply("AI error.");
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  if (!i.isButton()) return;

  const [action, id] = i.customId.split("_");
  const ch = i.guild.channels.cache.get(id);
  if (!ch) return;

  const owner = voiceOwners.get(id);
  const bans = voiceBans.get(id);

  if (bans?.has(i.user.id))
    return i.reply({ content: "Zbanowany", ephemeral: true });

  if (i.user.id !== owner && !isMod(i.member))
    return i.reply({ content: "Brak dostępu", ephemeral: true });

  if (action === "lock") {
    await ch.permissionOverwrites.edit(i.guild.id, { Connect: false });
    return i.reply({ content: "Zamknięto", ephemeral: true });
  }

  if (action === "unlock") {
    await ch.permissionOverwrites.edit(i.guild.id, { Connect: true });
    return i.reply({ content: "Otwarto", ephemeral: true });
  }

  if (action === "rename") {

    const modal = new ModalBuilder()
      .setCustomId(`rename_${id}`)
      .setTitle("Rename");

    const input = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("Nowa nazwa")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return i.showModal(modal);
  }

  if (action === "delete") {
    voiceOwners.delete(id);
    voiceBans.delete(id);
    ch.delete().catch(()=>{});
  }
});

// ================= MODAL =================
client.on("interactionCreate", async (i) => {

  if (!i.isModalSubmit()) return;

  if (i.customId.startsWith("rename_")) {

    const id = i.customId.split("_")[1];
    const ch = i.guild.channels.cache.get(id);

    const name = i.fields.getTextInputValue("name");

    await ch.setName(name);

    i.reply({ content: "Zmieniono", ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(TOKEN);
