require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");

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
  const r = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: process.env.API_TOKEN,
      ...payload
    })
  });
  return r.json();
}

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "lager") return;

  if (!ROUTE_CHANNEL_IDS.includes(i.channelId)) {
    return i.reply({
      content: "❌ Nur in Lager-Kanälen erlaubt",
      ephemeral: true
    });
  }

  const sub = i.options.getSubcommand();
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

  await i.deferReply({ ephemeral: true });

  const res = await post({
    action: "addTransaction",
    discordId: i.user.id,
    name: i.user.username,
    channel: i.channel.name,
    type,
    amount
  });

  if (!res.ok) {
    return i.editReply("❌ Sheet Fehler");
  }

  await post({ action: "writeWeeklySummary" });

  i.editReply(`✅ Gebucht: ${type} ${amount}`);
});

cron.schedule("5 0 * * 1", async () => {
  await post({ action: "rolloverWeek" });
  console.log("📦 Woche archiviert");
}, { timezone: "Europe/Zurich" });

client.once("ready", () => {
  console.log("🤖 Lagerbot online");
});

client.login(process.env.DISCORD_TOKEN);
