require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const command = new SlashCommandBuilder()
  .setName("lager")
  .setDescription("WRMC Lager Buchung")

  // Injektion rein
  .addSubcommand(sc =>
    sc.setName("injektion-rein")
      .setDescription("Injektion Eingang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  // Injektion raus
  .addSubcommand(sc =>
    sc.setName("injektion-raus")
      .setDescription("Injektion Ausgang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  // Blue rein
  .addSubcommand(sc =>
    sc.setName("blue-rein")
      .setDescription("Blaupulver Eingang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  // Blue raus
  .addSubcommand(sc =>
    sc.setName("blue-raus")
      .setDescription("Blaupulver Ausgang buchen")
      .addIntegerOption(o =>
        o.setName("menge")
          .setDescription("Menge")
          .setRequired(true)
      )
  )

  // Wochenabgabe (A/B/X)
  .addSubcommand(sc =>
    sc.setName("wochen-abgabe")
      .setDescription("Wochenabgabe setzen (A/B/X)")
      .addStringOption(o =>
        o.setName("typ")
          .setDescription("A = Pulver 1000, B = Schwarzgeld, X = Befreit")
          .setRequired(true)
          .addChoices(
            { name: "A", value: "A" },
            { name: "B", value: "B" },
            { name: "X", value: "X" }
          )
      )
  )

  // AUSBEZAHLT (User auswählen)
  .addSubcommand(sc =>
    sc.setName("ausbezahlt")
      .setDescription("Markiert einen Member als ausbezahlt (für diese KW)")
      .addUserOption(o =>
        o.setName("user")
          .setDescription("Wer wurde ausbezahlt?")
          .setRequired(true)
      )
      .addIntegerOption(o =>
        o.setName("betrag")
          .setDescription("Optionaler Betrag (nur Info)")
          .setRequired(false)
      )
  );

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.DISCORD_CLIENT_ID) throw new Error("DISCORD_CLIENT_ID fehlt");
    if (!process.env.GUILD_ID) throw new Error("GUILD_ID fehlt");
    if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN fehlt");

    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
      { body: [command.toJSON()] }
    );

    console.log("✅ /lager Commands erfolgreich registriert (inkl. ausbezahlt)");
  } catch (e) {
    console.error("❌ Deploy Fehler:", e);
  }
})();
