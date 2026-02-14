require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const SHEETS_URL = process.env.SHEETS_WEBAPP_URL;
const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;

client.once('ready', () => {
  console.log(`✅ Bot online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== 'lager') return;

  // ✅ Nur bestimmter Kanal erlaubt
  if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: "❌ Dieser Command darf nur im Kanal #route-buchungen benutzt werden.",
      ephemeral: true
    });
  }

  try {
    const action = interaction.options.getString('aktion');
    const item = interaction.options.getString('item');
    const menge = interaction.options.getInteger('menge');

    const userName =
      interaction.member?.displayName ||
      interaction.user.username;

    const payload = {
      user: userName,
      userid: interaction.user.id,
      action: action,
      item: item,
      menge: menge,
      server: interaction.guild.name,
      channel: interaction.channel.name
    };

    console.log("➡️ Sende an Sheets:", payload);

    const res = await fetch(SHEETS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log("Sheets Antwort:", text);

    await interaction.reply({
      content: `✅ Gebucht: ${menge} × ${item} (${action})`,
      ephemeral: false
    });

  } catch (err) {
    console.error("❌ Fehler:", err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Fehler beim Buchen.",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
