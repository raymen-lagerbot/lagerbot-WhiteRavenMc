require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const command = new SlashCommandBuilder()
  .setName("lager")
  .setDescription("WRMC Lager System")

  .addSubcommand(sc =>
    sc.setName("injektion-rein")
      .setDescription("Injektion Eingang buchen")
      .addIntegerOption(o =>
        o.setName("menge").setDescription("Menge").setRequired(true)
      )
  )
  .addSubcommand(sc =>
    sc.setName("injektion-raus")
      .setDescription("Injektion Ausgang buchen")
      .addIntegerOption(o =>
        o.setName("menge").setDescription("Menge").setRequired(true)
      )
  )
  .addSubcommand(sc =>
    sc.setName("blue-rein")
      .setDescription("Blaupulver Eingang buchen")
      .addIntegerOption(o =>
        o.setName("menge").setDescription("Menge").setRequired(true)
      )
  )
  .addSubcommand(sc =>
    sc.setName("blue-raus")
      .setDescription("Blaupulver Ausgang buchen")
      .addIntegerOption(o =>
        o.setName("menge").setDescription("Menge").setRequired(true)
      )
  )
  .addSubcommand(sc =>
    sc.setName("wochen-abgabe")
      .setDescription("Wochenabgabe setzen (A/B/X)")
      .addStringOption(o =>
        o.setName("typ")
          .setDescription("A/B/X")
          .setRequired(true)
          .addChoices(
            { name: "A", value: "A" },
            { name: "B", value: "B" },
            { name: "X", value: "X" }
          )
      )
  )
  .addSubcommand(sc =>
    sc.setName("ausbezahlt")
      .setDescription("Markiert einen Member als ausbezahlt (für diese KW)")
      .addUserOption(o =>
        o.setName("user").setDescription("Wer wurde ausbezahlt?").setRequired(true)
      )
      .addIntegerOption(o =>
        o.setName("betrag").setDescription("Optionaler Betrag (nur Info)").setRequired(false)
      )
  )

  // ✅ REPORT
  .addSubcommand(sc =>
    sc.setName("report")
      .setDescription("Postet den Wochenreport in #lager-reports")
      .addIntegerOption(o =>
        o.setName("kw")
          .setDescription("Optional: Kalenderwoche (z.B. 7)")
          .setRequired(false)
      )
  )

  // ✅ CONFIG
  .addSubcommand(sc =>
    sc.setName("config")
      .setDescription("Zeigt aktuelle Preise/Prozent/Mindest-Abgabe")
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

    console.log("✅ /lager Commands erfolgreich registriert (report + config inkl.)");
  } catch (e) {
    console.error("❌ Deploy Fehler:", e);
  }
})();
