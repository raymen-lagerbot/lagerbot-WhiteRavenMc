require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

// ====== CONFIG ======
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// WebApp URL MUSS /exec sein
const SHEET_URL = process.env.SHEET_URL;

// Nur dieser Channel erlaubt
const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;

// ====== BASIC CHECKS ======
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID || !SHEET_URL || !ALLOWED_CHANNEL_ID) {
  console.error("❌ ENV fehlt. Prüfe: DISCORD_TOKEN, CLIENT_ID, GUILD_ID, SHEET_URL, ALLOWED_CHANNEL_ID");
  process.exit(1);
}

// ====== CLIENT ======
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ====== COMMANDS ======
const commands = [
  new SlashCommandBuilder()
    .setName("lager")
    .setDescription("Lager buchen")
    .addStringOption((o) =>
      o.setName("aktion")
        .setDescription("rein oder raus")
        .setRequired(true)
        .addChoices(
          { name: "rein", value: "rein" },
          { name: "raus", value: "raus" }
        )
    )
    .addStringOption((o) =>
      o.setName("item")
        .setDescription("Item")
        .setRequired(true)
        .addChoices(
          { name: "Injektion", value: "Injektion" },
          { name: "Blaues", value: "Blaues" }
        )
    )
    .addIntegerOption((o) =>
      o.setName("menge").setDescription("Menge").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("auswertung")
    .setDescription("Zeigt die Auswertung einer Woche")
    .addStringOption((o) =>
      o.setName("woche")
        .setDescription("z.B. 2026-07 (leer = aktuelle Woche aus SETTINGS)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("ausbezahlt")
    .setDescription("Markiert einen User als ausbezahlt (ARCHIV -> paid TRUE)")
    .addStringOption((o) =>
      o.setName("woche")
        .setDescription("z.B. 2026-07")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("user")
        .setDescription("z.B. Raymen")
        .setRequired(true)
    ),
].map((c) => c.toJSON());

// ====== DEPLOY COMMANDS ======
async function deployCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log("✅ Commands deployed");
}

// ====== HELPERS ======
function inAllowedChannel(interaction) {
  return interaction.channelId === ALLOWED_CHANNEL_ID;
}

async function sheetPost(bodyObj) {
  const res = await fetch(SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  });

  const text = await res.text();

  // Google Script liefert JSON – wenn nicht: Fehler zeigen
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Sheet Antwort ist kein JSON (HTTP ${res.status}): ${text.slice(0, 200)}...`);
  }

  if (!res.ok || json.status !== "ok") {
    throw new Error(`Sheet Fehler: ${JSON.stringify(json)}`);
  }
  return json;
}

async function sheetGetReport(weekMaybe) {
  const url = new URL(SHEET_URL);
  url.searchParams.set("action", "report");
  if (weekMaybe) url.searchParams.set("week", weekMaybe);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Report Antwort kein JSON (HTTP ${res.status}): ${text.slice(0, 200)}...`);
  }

  if (!res.ok || json.status !== "ok") {
    throw new Error(`Report Fehler: ${JSON.stringify(json)}`);
  }

  return json.report;
}

// ====== BOT EVENTS ======
client.once("ready", () => {
  console.log(`✅ Online als ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Kanal sperre
  if (!inAllowedChannel(interaction)) {
    return interaction.reply({
      content: `❌ Nur im erlaubten Kanal nutzbar.`,
      ephemeral: true,
    });
  }

  try {
    // /lager
    if (interaction.commandName === "lager") {
      const aktion = interaction.options.getString("aktion", true);
      const item = interaction.options.getString("item", true);
      const menge = interaction.options.getInteger("menge", true);

      const payload = {
        user: interaction.user.username,
        userid: interaction.user.id,
        action: aktion,
        item,
        menge,
        server: interaction.guild?.name || "",
        channel: interaction.channel?.name || "",
      };

      const out = await sheetPost(payload);

      return interaction.reply({
        content: `✅ Gebucht: **${aktion}** | **${item}** | **${menge}** (Woche: ${out.week})`,
        ephemeral: true,
      });
    }

    // /auswertung
    if (interaction.commandName === "auswertung") {
      const week = interaction.options.getString("woche", false) || "";
      const report = await sheetGetReport(week || null);

      if (!report.rows.length) {
        return interaction.reply({
          content: `ℹ️ Keine Daten in AUSWERTUNG für Woche **${report.week}**.`,
          ephemeral: true,
        });
      }

      const lines = report.rows
        .slice(0, 15)
        .map((r, i) => `${i + 1}. **${r.user}** | Inj: ${r.injektion} | Blau: ${r.blaues} | Total: ${r.total_menge} | Betrag: ${r.betrag}`);

      return interaction.reply({
        content: `📊 **Auswertung Woche ${report.week}**\n${lines.join("\n")}`,
        ephemeral: true,
      });
    }

    // /ausbezahlt
    if (interaction.commandName === "ausbezahlt") {
      const week = interaction.options.getString("woche", true);
      const user = interaction.options.getString("user", true);

      const out = await sheetPost({
        action: "paid",
        week,
        user,
        paid_by: interaction.user.username,
      });

      return interaction.reply({
        content: `✅ Markiert als ausbezahlt: **${user}** (Woche **${week}**) → updated: ${out.result.updated}`,
        ephemeral: true,
      });
    }
  } catch (err) {
    return interaction.reply({
      content: `❌ Fehler: ${String(err.message || err)}`,
      ephemeral: true,
    });
  }
});

// ====== START ======
(async () => {
  await deployCommands();
  await client.login(DISCORD_TOKEN);
})();
