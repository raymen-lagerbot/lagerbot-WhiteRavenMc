require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const cmd = new SlashCommandBuilder()
  .setName("lager")
  .setDescription("WRMC Lager Buchung")
  .addSubcommand(sc =>
    sc.setName("injektion-rein")
      .setDescription("Injektion Eingang")
      .addIntegerOption(o => o.setName("menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("injektion-raus")
      .setDescription("Injektion Ausgang")
      .addIntegerOption(o => o.setName("menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("blue-rein")
      .setDescription("Blaupulver Eingang")
      .addIntegerOption(o => o.setName("menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("blue-raus")
      .setDescription("Blaupulver Ausgang")
      .addIntegerOption(o => o.setName("menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("wochen-abgabe")
      .setDescription("Wochenabgabe A/B/X")
      .addStringOption(o =>
        o.setName("typ").setRequired(true).addChoices(
          { name: "A", value: "A" },
          { name: "B", value: "B" },
          { name: "X", value: "X" }
        )
      )
  );

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: [cmd.toJSON()] }
  );
  console.log("✅ /lager registriert");
})();
