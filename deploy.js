require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const command = new SlashCommandBuilder()
  .setName("lager")
  .setDescription("WRMC Lager System")

  .addSubcommand(sc =>
    sc.setName("injektion-rein")
      .setDescription("Injektion Eingang buchen")
      .addIntegerOption(o => o.setName("menge").setDescription("Menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("injektion-raus")
      .setDescription("Injektion Ausgang buchen")
      .addIntegerOption(o => o.setName("menge").setDescription("Menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("blue-rein")
      .setDescription("Blaupulver Eingang buchen")
      .addIntegerOption(o => o.setName("menge").setDescription("Menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("blue-raus")
      .setDescription("Blaupulver Ausgang buchen")
      .addIntegerOption(o => o.setName("menge").setDescription("Menge").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("wochen-abgabe")
      .setDescription("Wochenabgabe setzen (A/B/X)")
      .addStringOption(o =>
        o.setName("typ").setDescription("A/B/X").setRequired(true)
          .addChoices({ name: "A", value: "A" }, { name: "B", value: "B" }, { name: "X", value: "X" })
      )
  )

  // ✅ Admin: Ausbezahlt
  .addSubcommand(sc =>
    sc.setName("ausbezahlt")
      .setDescription("Markiert einen Member als ausbezahlt")
      .addUserOption(o => o.setName("user").setDescription("Wer wurde ausbezahlt?").setRequired(true))
      .addIntegerOption(o => o.setName("betrag").setDescription("Optionaler Betrag").setRequired(false))
  )

  // ✅ Admin: Report
  .addSubcommand(sc =>
    sc.setName("report")
      .setDescription("Postet den Wochenreport in #lager-reports")
      .addIntegerOption(o => o.setName("kw").setDescription("Optional: Kalenderwoche").setRequired(false))
  )

  // ✅ Admin: Config
  .addSubcommand(sc =>
    sc.setName("config")
      .setDescription("Zeigt aktuelle Preise/Prozent/Mindest-Abgabe")
  )

  // ✅ Admin: Panel (Buttons)
  .addSubcommand(sc =>
    sc.setName("panel")
      .setDescription("Zeigt das Wochenabschluss-Panel (Pause / Abschluss & Neustart)")
  )

  // ✅ Admin: bunker-set
  .addSubcommand(sc =>
    sc.setName("bunker-set")
      .setDescription("Setzt den Bunkerbestand (Korrekturbuchung)")
      .addIntegerOption(o => o.setName("injektion").setDescription("Ziel-Bestand Injektionen").setRequired(true))
      .addIntegerOption(o => o.setName("pulver").setDescription("Ziel-Bestand Blaupulver").setRequired(true))
      .addStringOption(o => o.setName("grund").setDescription("Optional: Grund/Notiz").setRequired(false))
  );

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
      { body: [command.toJSON()] }
    );
    console.log("✅ /lager Commands registriert (inkl. bunker-set/panel)");
  } catch (e) {
    console.error("❌ Deploy Fehler:", e);
  }
})();
