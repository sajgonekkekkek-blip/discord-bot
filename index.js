const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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

// ================= READY =================
client.once("ready", async () => {
  console.log("BOT ONLINE");
});

// ================= AI (NAPRAWIONE) =================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.id !== AI_CHANNEL_ID) return;

  if (!OPENAI_KEY) {
    return message.reply("❌ Brak OPENAI_KEY w konfiguracji bota.");
  }

  try {

    await message.channel.sendTyping();

    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Jesteś pomocnym asystentem Discord. Odpowiadasz po polsku."
          },
          {
            role: "user",
            content: message.content
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = res.data?.choices?.[0]?.message?.content;

    if (!reply) {
      return message.reply("❌ AI nie zwróciło odpowiedzi.");
    }

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🤖 AI Assistant")
          .setColor("#0099ff")
          .setDescription(reply.slice(0, 4000))
      ]
    });

  } catch (e) {

    const err =
      e?.response?.data?.error?.message ||
      e?.response?.data ||
      e?.message;

    console.log("OPENAI ERROR:", err);

    return message.reply("❌ AI chwilowo nie działa: `" + err + "`");
  }
});

// ================= VOICE SYSTEM =================
client.on("voiceStateUpdate", async (oldState, newState) => {

  if (newState.channelId === CREATE_CHANNEL_ID) {

    const member = newState.member;

    const voice = await newState.guild.channels.create({
      name: `kanal-${member.user.username}`,
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
      .setTitle("🎛️ PANEL KANAŁU")
      .setColor("#5865F2")
      .setDescription("Zarządzanie kanałem");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lock_${voice.id}`).setLabel("Zamknij").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`unlock_${voice.id}`).setLabel("Otwórz").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`rename_${voice.id}`).setLabel("Rename").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`delete_${voice.id}`).setLabel("Usuń").setStyle(ButtonStyle.Danger)
    );

    panel.send({ embeds: [embed], components: [row] });
  }
});

// ================= BUTTONS =================
client.on("interactionCreate", async (i) => {

  if (!i.isButton()) return;

  const [action, id] = i.customId.split("_");
  const ch = i.guild.channels.cache.get(id);
  if (!ch) return;

  const owner = voiceOwners.get(id);

  if (i.user.id !== owner && !i.member.roles.cache.has(MOD_ROLE) && i.user.id !== OWNER_ID)
    return i.reply({ content: "Brak dostępu", ephemeral: true });

  if (action === "lock") {
    await ch.permissionOverwrites.edit(i.guild.id, { Connect: false });
    return i.reply({ content: "Kanał zamknięty", ephemeral: true });
  }

  if (action === "unlock") {
    await ch.permissionOverwrites.edit(i.guild.id, { Connect: true });
    return i.reply({ content: "Kanał otwarty", ephemeral: true });
  }

  if (action === "rename") {

    const modal = new ModalBuilder()
      .setCustomId(`rename_${id}`)
      .setTitle("Zmień nazwę");

    const input = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("Nowa nazwa kanału")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return i.showModal(modal);
  }

  if (action === "delete") {
    voiceOwners.delete(id);
    voiceBans.delete(id);
    ch.delete().catch(() => {});
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

    return i.reply({ content: "Zmieniono nazwę", ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(TOKEN);
