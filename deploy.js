require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const cmdLager = new SlashCommandBuilder()
  .setName('lager')
  .setDescription('Lager buchen')
  .addStringOption(o =>
    o.setName('aktion')
      .setDescription('rein oder raus')
      .setRequired(true)
      .addChoices(
        { name: 'rein', value: 'rein' },
        { name: 'raus', value: 'raus' }
      ))
  .addStringOption(o =>
    o.setName('item')
      .setDescription('Item')
      .setRequired(true)
      .addChoices(
        { name: 'Injektion', value: 'Injektion' },
        { name: 'Blaues', value: 'Blaues' }
      ))
  .addIntegerOption(o =>
    o.setName('menge')
      .setDescription('Menge')
      .setRequired(true));

const cmdReport = new SlashCommandBuilder()
  .setName('wochenreport')
  .setDescription('Zeigt Wochenreport aus Google Sheets')
  .addStringOption(o =>
    o.setName('week')
      .setDescription('Optional: z.B. 2026-07 (leer = aktuelle Woche)')
      .setRequired(false));

const cmdPaid = new SlashCommandBuilder()
  .setName('ausbezahlt')
  .setDescription('Markiert einen User als ausbezahlt (ARCHIV)')
  .addStringOption(o =>
    o.setName('user')
      .setDescription('User-Name wie im AUSWERTUNG/ARCHIV (z.B. Raymen)')
      .setRequired(true))
  .addStringOption(o =>
    o.setName('week')
      .setDescription('Optional: z.B. 2026-07 (leer = aktuelle Woche)')
      .setRequired(false));

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [cmdLager.toJSON(), cmdReport.toJSON(), cmdPaid.toJSON()] }
  );
  console.log("✅ Commands bereit");
})();
