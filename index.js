require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");

// fetch fix (Railway / Node sicher)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* ======== DEINE ERLAUBTEN CHANNELS ======== */
const ROUTE_CHANNEL_IDS = [
  "1471986598886510653", // injektion-rein
  "1471986731484975135", // injektion-raus
  "1472654099110563880", // blue-rein
  "1472654198779674769", // blue-raus
  "1472703728757772552", // ausbezahlt
  "1472339361789116589", // wochen-abgabe
  "1472703883854872586"  // routen-buchungen
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

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: `AppsScript kein JSON. Status=${res.status} Body=${text.slice(0, 200)}`
    };
  }
}

// Hilfsfunktion: Server-Nickname holen (Fallbacks)
function getBestName(interaction, userObj) {
  // Bei dem ausführenden User (interaction.user) klappt nickname oft direkt über interaction.member
  if (!userObj || !interaction) return "Unknown";

  // Wenn es der ausführende User ist:
  if (interaction.user?.id === userObj.id) {
    return (
      interaction.member?.nickname ||
      interaction.member?.user?.globalName ||
      interaction.user.globalName ||
      interaction.user.username
    );
  }

  // Für Ziel-User (ausbezahlt):
  // In Interactions ist members cache manchmal nicht voll → wir nutzen sichere Fallbacks
  const cached = interaction.guild?.members?.cache?.get(userObj.id);
  return (
    cached?.nickname ||
    userObj.globalName ||
    userObj.username
  );
}

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "lager") return;

  try {
    await i.deferReply({ ephemeral: true });

    if (!ROUTE_CHANNEL_IDS.includes(i.channelId)) {
      return i.editReply("❌ Nur in Lager-Kanälen erlaubt.");
    }

    const sub = i.options.getSubcommand(false);
    if (!sub) {
      return i.editReply(
        "❌ Subcommand wählen: injektion-rein / injektion-raus / blue-rein / blue-raus / wochen-abgabe / ausbezahlt"
      );
    }

    const actorName = getBestName(i, i.user);

    // ====== AUSBEZAHLT (User auswählen) ======
    if (sub === "ausbezahlt") {
      const targetUser = i.options.getUser("user", true);
      const betrag = i.options.getInteger("betrag") || 0;

      const targetName = getBestName(i, targetUser);

      const result = await post({
        action: "addTransaction",
        // WICHTIG: discordId vom Ausbezahlten
        discordId: targetUser.id,
        name: targetName,
        channel: i.channel?.name || i.channelId,
        type: "PAID",
        amount: betrag,
        meta: {
          paidById: i.user.id,
          paidByName: actorName
        }
      });

      if (!result.ok) {
        return i.editReply(`❌ Sheet Fehler: ${result.error}`);
      }

      await post({ action: "writeWeeklySummary" });

      return i.editReply(
        `✅ Ausbezahlt markiert: **${targetName}**${betrag ? ` (Betrag: ${betrag})` : ""}`
      );
    }

    // ====== Standard Buchungen ======
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
      name: actorName,
      channel: i.channel?.name || i.channelId,
      type,
      amount
    });

    if (!result.ok) {
      return i.editReply(`❌ Sheet Fehler: ${result.error}`);
    }

    await post({ action: "writeWeeklySummary" });

    return i.editReply(`✅ Gebucht: ${type} ${amount}`);
  } catch (err) {
    console.error("Interaction Error:", err);
    const msg = `❌ Bot Fehler: ${String(err).slice(0, 1500)}`;

    if (i.deferred || i.replied) {
      return i.editReply(msg);
    } else {
      return i.reply({ content: msg, ephemeral: true });
    }
  }
});

// Wochenwechsel Automatik — Montag 00:05 (Zürich)
cron.schedule(
  "5 0 * * 1",
  async () => {
    try {
      await post({ action: "rolloverWeek" });
      console.log("📦 Woche archiviert");
    } catch (e) {
      console.error("Weekly rollover Fehler:", e);
    }
  },
  { timezone: "Europe/Zurich" }
);

client.once("ready", () => {
  console.log(`🤖 Lagerbot online als ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
