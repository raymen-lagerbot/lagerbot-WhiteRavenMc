require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`Bot online als ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {

    if (interaction.commandName === 'lager') {

      const data = {
        type: "lager",
        user: interaction.options.getString('user'),
        item: interaction.options.getString('item'),
        menge: interaction.options.getInteger('menge')
      };

      await sendToSheet(data);
      await interaction.reply("✅ Lager gespeichert");

    }

    if (interaction.commandName === 'route') {

      const data = {
        type: "route",
        fahrer: interaction.options.getString('fahrer'),
        kisten: interaction.options.getInteger('kisten')
      };

      await sendToSheet(data);
      await interaction.reply("🚚 Route gespeichert");

    }

    if (interaction.commandName === 'report') {

      const res = await fetch(process.env.SCRIPT_URL + "?report=1");
      const text = await res.text();

      await interaction.reply("📊 Wochenreport:\n" + text);

    }

  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ Fehler",
      ephemeral: true
    });
  }
});

async function sendToSheet(data) {
  await fetch(process.env.SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

client.login(process.env.DISCORD_TOKEN);
