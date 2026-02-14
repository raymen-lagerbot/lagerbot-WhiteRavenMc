require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  // ✅ Nur Guilds nötig (keine disallowed intents)
  intents: [GatewayIntentBits.Guilds]
});

const SHEETS_URL = process.env.SHEETS_WEBAPP_URL;
const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;

async function sendToSheets(payload) {
  const res = await fetch(SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log("Sheets Antwort:", text);
  return text;
}

client.once('ready', () => {
  console.log(`✅ Bot online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'lager') return;

  // ✅ Nur in einem bestimmten Textkanal erlauben
  if (ALLOWED_CHANNEL_ID && interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: "❌ Bitte nur im Kanal #route-buchungen benutzen.",
      ephemeral: true
    });
  }

  // schnelle Antwort, damit Discord nicht timeoutet
  await interaction.deferReply({ ephemeral: true });

  try {
    const action = interaction.options.getString('aktion');
    const item = interaction.options.getString('item');
    const menge = interaction.options.getInteger('menge');

    // ✅ Server-Nickname (Display Name) falls vorhanden
    const userName = interaction.member?.displayName || interaction.user.username;

    const payload = {
      user: userName,
      userid: interaction.user.id,
      action,
      item,
      menge,
      server: interaction.guild?.name || "",
      channel: interaction.channel?.name || ""
    };

    console.log("➡️ Sende an Sheets:", payload);

    await sendToSheets(payload);

    // Optional: Nachricht in den Channel posten (öffentlich)
    // Falls du das willst, lass es drin, sonst löschen.
    await interaction.channel.send(`✅ ${userName}: ${action} ${menge} × ${item}`);

    await interaction.editReply(`✅ Gebucht: ${menge} × ${item} (${action})`);

  } catch (err) {
    console.error("❌ Fehler:", err);
    await interaction.editReply("❌ Fehler beim Buchen (bitte Logs prüfen).");
  }
});

client.login(process.env.DISCORD_TOKEN);

