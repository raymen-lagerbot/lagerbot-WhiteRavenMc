require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");

// fetch fix (Railway / Node sicher)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const ROUTE_CHANNEL_IDS = [
  "1471986598886510653",
  "1471986731484975135",
  "1472654099110563880",
  "1472654198779674769",
  "1472703728757772552",
  "1472339361789116589",
  "1472703883854872586"
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function post(payload) {
  const res = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: process.env.API_TOKEN,
      ...payload
    })
  });
  return res.json();
}

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "lager") return;

  try {
    // sofort antworten → verhindert Timeout
    await i.deferReply({ ephemeral: true });

    if (!ROUTE_CHANNEL_IDS.includes(i.channelId)) {
      return i.editReply("❌ /lager nur in Lager-Kanälen erlaubt.");
    }

    const sub = i.options.getSubcommand(false);

    if (!sub) {
      return i.editReply(
        "❌ Bitte Subcommand wählen: injektion-rein / injektion-raus / blue-rein / blue-raus / wochen-abgabe"
      );
    }

    const menge = i.options.getInteger("menge");
    const typ = i.options.getString("typ");

    let type = null;
    let amount = menge || 0;

    if (sub === "injektion-rein") type = "INJ_IN";
    if (sub === "injektion-raus") type = "INJ_OUT";
    if (sub === "blue-rein") type = "PULVER_IN";
    if (sub === "blue-raus") type = "PULVER_OUT";

    if (sub === "wochen-abgabe") {
      if (typ === "A") type = "WOCHENABGABE_A";
      if (typ === "B") type = "WOCHENABGABE_B";
      if (typ === "X") type = "BEFREIT_X";
      amount = 0;
    }

    if (!type) {
      return i.editReply("❌ Ungültiger Subcommand.");
    }

    const result = await post({
      action: "addTransaction",
      discordId: i.user.id,
      name: i.user.username,
      channel: i.channel?.name || i.channelId,
      type,
      amount
    });

    if (!result.ok) {
      return i.editReply(`❌ Sheet Fehler: ${result.error || "unknown"}`);
    }

    // Anzeige aktualisieren
    await post({ action: "writeWeeklySummary" });

    return i.editReply(`✅ Gebucht: ${type} ${amount}`);
  } catch (err) {
    console.error("❌ Interaction Error:", err);

    const msg = `❌ Bot Fehler: ${String(err).slice(0, 1500)}`;

    if (i.deferred || i.replied) {
      return i.editReply(msg);
    } else {
      return i.reply({ content: msg, ephemeral: true });
    }
  }
});

// Wochenwechsel Automatik
cron.schedule(
  "5 0 * * 1",
  async () => {
    try {
      await post({ action: "rolloverWeek" });
      console.log("📦 Woche archiviert");
    } catch (e) {
      console.error("❌ Weekly rollover Fehler:", e);
    }
  },
  { timezone: "Europe/Zurich" }
);

client.once("ready", () => {
  console.log(`🤖 Lagerbot online als ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

