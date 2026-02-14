require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const cmd = new SlashCommandBuilder()
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

const rest = new REST({ version: '10' })
  .setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: [cmd.toJSON()] }
  );

  console.log("Commands bereit");
})();
