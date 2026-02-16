require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");

// fetch fix
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* ========= CHANNEL CONFIG ========= */

const ROUTE_CHANNEL_IDS = [
  "1471986598886510653",
  "1471986731484975135",
  "1472654099110563880",
  "1472654198779674769",
  "1472703728757772552",
  "1472339361789116589",
  "1472703883854872586"
];

const REPORT_CHANNEL_ID = "1473018767071252521";
const ADMIN_CHANNEL_ID  = "1473018857626272018";

/* ========= CLIENT ========= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ========= APPS SCRIPT CALL ========= */

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
    return { ok:false, error:`AppsScript kein JSON: ${text.slice(0,200)}` };
  }
}

/* ========= NAME HELPER ========= */

function getBestName(i, user) {
  if (i.user.id === user.id) {
    return (
      i.member?.nickname ||
      i.member?.user?.globalName ||
      i.user.globalName ||
      i.user.username
    );
  }

  const cached = i.guild?.members?.cache?.get(user.id);
  return cached?.nickname || user.globalName || user.username;
}

/* ========= COMMAND HANDLER ========= */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "lager") return;

  try {
    await i.deferReply({ ephemeral: true });

    const sub = i.options.getSubcommand(false);
    if (!sub) return i.editReply("❌ Subcommand fehlt.");

    /* ===== AUSBEZAHLT NUR ADMIN CHANNEL ===== */

    if (sub === "ausbezahlt") {

      if (i.channelId !== ADMIN_CHANNEL_ID) {
        return i.editReply("❌ Dieser Befehl nur im #lager-admin Kanal.");
      }

      const targetUser = i.options.getUser("user", true);
      const betrag = i.options.getInteger("betrag") || 0;

      const targetName = getBestName(i, targetUser);
      const actorName = getBestName(i, i.user);

      const result = await post({
        action: "addTransaction",
        discordId: targetUser.id,
        name: targetName,
        channel: i.channel.name,
        type: "PAID",
        amount: betrag,
        meta: {
          paidBy: actorName
        }
      });

      if (!result.ok) return i.editReply(`❌ ${result.error}`);

      await post({ action: "writeWeeklySummary" });

      return i.editReply(`✅ Ausbezahlt markiert: ${targetName}`);
    }

    /* ===== NORMALE LAGER CHANNELS ===== */

    if (!ROUTE_CHANNEL_IDS.includes(i.channelId)) {
      return i.editReply("❌ Nur in Lager-Kanälen erlaubt.");
    }

    const menge = i.options.getInteger("menge");
    const typ = i.options.getString("typ");

    const actorName = getBestName(i, i.user);

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

    if (!type) return i.editReply("❌ Ungültiger Subcommand.");

    const result = await post({
      action: "addTransaction",
      discordId: i.user.id,
      name: actorName,
      channel: i.channel.name,
      type,
      amount
    });

    if (!result.ok) return i.editReply(`❌ ${result.error}`);

    await post({ action: "writeWeeklySummary" });

    return i.editReply(`✅ Gebucht: ${type} ${amount}`);

  } catch (err) {
    console.error(err);
    return i.editReply(`❌ Bot Fehler`);
  }
});

/* ========= WEEKLY ROLLOVER ========= */

cron.schedule("5 0 * * 1", async () => {
  try {
    await post({ action: "rolloverWeek" });

    const ch = await client.channels.fetch(REPORT_CHANNEL_ID).catch(()=>null);
    if (ch) ch.send("📦 Wochenarchiv automatisch erstellt.");

    console.log("Woche archiviert");

  } catch(e) {
    console.error("Rollover Fehler", e);
  }
}, { timezone: "Europe/Zurich" });

/* ========= READY ========= */

client.once("ready", () => {
  console.log(`🤖 Lagerbot online als ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
