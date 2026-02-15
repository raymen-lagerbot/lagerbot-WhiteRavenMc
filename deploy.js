require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [

  new SlashCommandBuilder()
    .setName('lager')
    .setDescription('Lager Eintrag erstellen')
    .addStringOption(o =>
      o.setName('user')
        .setDescription('Name')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('item')
        .setDescription('Ware')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('menge')
        .setDescription('Menge')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('route')
    .setDescription('Route eintragen')
    .addStringOption(o =>
      o.setName('fahrer')
        .setDescription('Fahrer')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('kisten')
        .setDescription('Kisten')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Wochenreport abrufen')

].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Deploying commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('Commands deployed.');
  } catch (err) {
    console.error(err);
  }
})();
