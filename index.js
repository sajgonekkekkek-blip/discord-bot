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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const axios = require("axios");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;

const OWNER_ID = "1311750832374419535";
const MOD_ROLE = "1497541728306204712";
const OWNER_ROLE = "1497524742868045934";

const CREATE_CHANNEL_ID = "1497611703280734428";
const VOICE_CATEGORY_ID = "1497524528060956723";

const AI_CHANNEL_ID = "1497629571275559042";

// ================= BAD WORD FILTER =================
const BAD_WORDS = ["kurwa","chuj","jeb","pierd","fuck","shit"];

function isBad(text) {
  return BAD_WORDS.some(w => text.toLowerCase().includes(w));
}

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

// ================= READY =================
client.once("ready", async () => {
  console.log("BOT ONLINE");

  const channel = await client.channels.fetch(AI_CHANNEL_ID);

  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle("🤖 AI Assistant")
      .setColor("#00AEEF")
      .setDescription(
`Witaj w systemie AI.

━━━━━━━━━━━━━━━━━━

To miejsce służy do zadawania pytań AI.

Zasady:
• Nie używaj wulgaryzmów
• Nie spamuj wiadomości
• AI odpowiada automatycznie
• Zachowuj kulturę

━━━━━━━━━━━━━━━━━━

System działa automatycznie i może się mylić.`
      );

    channel.send({ embeds: [embed] });
  }
});

// ================= VOICE SYSTEM =================
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (newState.channelId === CREATE_CHANNEL_ID) {

    const member = newState.member;

    const voice = await newState.guild.channels.create({
      name: `Kanał ${member.user.username}`,
      type: ChannelType.GuildVoice,
      parent: VOICE_CATEGORY_ID
    });

    const panel = await newState.guild.channels.create({
      name: `panel-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: VOICE_CATEGORY_ID,
      permissionOverwrites: [
        { id: newState.guild.id, deny: ["ViewChannel"] },
        { id: member.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    voiceOwners.set(voice.id, member.id);
    voiceBans.set(voice.id, new Set());

    await member.voice.setChannel(voice);

    const embed = new EmbedBuilder()
      .setTitle("🎛️ Panel kanału")
      .setColor("#5865F2")
      .setDescription(
`Zarządzanie kanałem:

🔒 Zamknij / Otwórz
✏️ Zmień nazwę
👢 Kick
⛔ Ban / Unban

Kanał usuwa się po 60 sekundach pustki.`
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lock_${voice.id}`).setStyle(2).setLabel("Zamknij"),
      new ButtonBuilder().setCustomId(`unlock_${voice.id}`).setStyle(2).setLabel("Otwórz"),
      new ButtonBuilder().setCustomId(`rename_${voice.id}`).setStyle(1).setLabel("Rename")
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`kick_${voice.id}`).setStyle(2).setLabel("Kick"),
      new ButtonBuilder().setCustomId(`ban_${voice.id}`).setStyle(4).setLabel("Ban"),
      new ButtonBuilder().setCustomId(`unban_${voice.id}`).setStyle(3).setLabel("Unban"),
      new ButtonBuilder().setCustomId(`delete_${voice.id}`).setStyle(4).setLabel("Delete")
    );

    await panel.send({ embeds: [embed], components: [row1, row2] });

    voicePanels.set(voice.id, panel.id);
  }

  // AUTO DELETE
  if (oldState.channelId && voiceOwners.has(oldState.channelId)) {

    const ch = oldState.channel;

    if (ch && ch.members.size === 0) {

      setTimeout(async () => {

        const check = oldState.guild.channels.cache.get(oldState.channelId);
        if (!check || check.members.size > 0) return;

        const panelId = voicePanels.get(oldState.channelId);
        const panel = oldState.guild.channels.cache.get(panelId);

        if (panel) panel.delete().catch(()=>{});

        voiceOwners.delete(oldState.channelId);
        voiceBans.delete(oldState.channelId);
        voicePanels.delete(oldState.channelId);

        check.delete().catch(()=>{});

      }, 60000);
    }
  }
});

// ================= AI SYSTEM =================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  // tylko kanał AI
  if (message.channel.id !== AI_CHANNEL_ID) return;

  const text = message.content;

  // filtr
  if (isBad(text)) {
    await message.delete().catch(()=>{});
    return;
  }

  // antyspam minimalny
  if (text.length > 800) {
    return message.reply("Za długa wiadomość.");
  }

  try {

    const res = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Jesteś spokojnym, pomocnym AI. Odpowiadasz krótko i bez emocji."
        },
        {
          role: "user",
          content: text
        }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const reply = res.data.choices[0].message.content;

    const embed = new EmbedBuilder()
      .setTitle("🤖 AI")
      .setColor("#00AEEF")
      .setDescription(reply.slice(0, 4000));

    message.reply({ embeds: [embed] });

  } catch (e) {
    console.log(e);
    message.reply("AI chwilowo nie działa.");
  }
});

// ================= LOGIN =================
client.login(TOKEN);
