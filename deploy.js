require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const command = new SlashCommandBuilder()
  .setName("lager")
  .setDescription("WRMC Lager Buchung")

  .addSubcommand(sc =>
    sc.setName("injektion-rein")
      .setDescription("Injektion Eingang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  .addSubcommand(sc =>
    sc.setName("injektion-raus")
      .setDescription("Injektion Ausgang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  .addSubcommand(sc =>
    sc.setName("blue-rein")
      .setDescription("Blaupulver Eingang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  .addSubcommand(sc =>
    sc.setName("blue-raus")
      .setDescription("Blaupulver Ausgang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  .addSubcommand(sc =>
    sc.setName("wochen-abgabe")
      .setDescription("Wochenabgabe setzen")
      .addStringOption(o =>
        o.setName("typ")
          .setDescription("A / B / X")
          .setRequired(true)
          .addChoices(
            { name: "A", value: "A" },
            { name: "B", value: "B" },
            { name: "X", value: "X" }
          )
      )
  );

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: [command.toJSON()] }
    );

    console.log("✅ /lager Commands erfolgreich registriert");
  } catch (e) {
    console.error("❌ Deploy Fehler:", e);
  }
})();
