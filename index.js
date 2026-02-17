require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");

// fetch fix
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* ========= CHANNEL CONFIG ========= */

const ROUTE_CHANNEL_IDS = [
  "1471986598886510653", // injektion-rein
  "1471986731484975135", // injektion-raus
  "1472654099110563880", // blue-rein
  "1472654198779674769", // blue-raus
  "1472703728757772552", // ausbezahlt (alt, bleibt ok)
  "1472339361789116589", // wochen-abgabe
  "1472703883854872586"  // routen-buchungen
];

const REPORT_CHANNEL_ID = "1473018767071252521"; // lager-reports
const ADMIN_CHANNEL_ID  = "1473018857626272018"; // lager-admin

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
    return { ok: false, error: `AppsScript kein JSON: ${text.slice(0, 200)}` };
  }
}

function getBestName(i, user) {
  if (!user) return "Unknown";
  if (i.user?.id === user.id) {
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

async function sendReportToChannel(guild, embed) {
  const ch = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
  if (!ch) return false;
  await ch.send({ embeds: [embed] });
  return true;
}

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString("de-CH");
}

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "lager") return;

  try {
    await i.deferReply({ ephemeral: true });

    const sub = i.options.getSubcommand(false);
    if (!sub) return i.editReply("❌ Subcommand fehlt.");

    const actorName = getBestName(i, i.user);

    /* ====== CONFIG (Admin empfohlen, aber nicht zwingend) ====== */
    if (sub === "config") {
      // Optional: nur admin channel
      if (i.channelId !== ADMIN_CHANNEL_ID) {
        return i.editReply("❌ /lager config bitte im #lager-admin verwenden.");
      }

      const cfg = await post({ action: "getConfig" });
      if (!cfg.ok) return i.editReply(`❌ Sheet Fehler: ${cfg.error}`);

      const price = cfg.data?.PRICE_PER_PULVER ?? 225;
      const cut = cfg.data?.CUT_PERCENT ?? 20;
      const min = cfg.data?.MIN_ABGABE_PULVER ?? 1000;

      return i.editReply(
        `⚙️ **Aktuelle Config**\n` +
        `• Preis pro Pulver: **${price}**\n` +
        `• Schwarzgeld: **${cut}%**\n` +
        `• Mindest-Abgabe (pro Member): **${min} Pulver**\n` +
        `\nÄndern: Apps Script → Projekt-Einstellungen → Script Properties`
      );
    }

    /* ====== REPORT ====== */
    if (sub === "report") {
      // Optional: nur admin channel
      if (i.channelId !== ADMIN_CHANNEL_ID) {
        return i.editReply("❌ /lager report bitte im #lager-admin verwenden.");
      }

      const kw = i.options.getInteger("kw") || undefined;

      const [cfg, sum] = await Promise.all([
        post({ action: "getConfig" }),
        post({ action: "getWeeklySummary", kw })
      ]);

      if (!sum.ok) return i.editReply(`❌ Sheet Fehler: ${sum.error}`);

      const rows = Array.isArray(sum.data) ? sum.data : [];
      const usedKw = sum.kw ?? kw ?? "?";

      const price = cfg.ok ? (cfg.data?.PRICE_PER_PULVER ?? 225) : 225;
      const cut = cfg.ok ? (cfg.data?.CUT_PERCENT ?? 20) : 20;
      const min = cfg.ok ? (cfg.data?.MIN_ABGABE_PULVER ?? 1000) : 1000;

      // Summen
      let totalNet = 0;
      let totalSchwarz = 0;
      let totalGross = 0;
      let totalPayoutablePulver = 0;

      // Textzeilen (kurz halten)
      const lines = rows
        .sort((a, b) => (Number(b.payout_net || 0) - Number(a.payout_net || 0)))
        .slice(0, 25)
        .map(r => {
          totalNet += Number(r.payout_net || 0);
          totalSchwarz += Number(r.schwarzgeld_20 || 0);
          totalGross += Number(r.payout_gross || 0);
          totalPayoutablePulver += Number(r.payoutable_pulver || 0);

          const paid = r.paid ? "✅" : "⏳";
          const name = r.name || "Unbekannt";
          const payoutNet = money(r.payout_net || 0);
          const abg = r.wochenabgabe || "-";
          const pPulver = money(r.payoutable_pulver || 0);

          return `${paid} **${name}** • Abgabe: **${abg}** • Auszahlbar: **${pPulver}** • Netto: **${payoutNet}**`;
        });

      const embed = new EmbedBuilder()
        .setTitle(`📊 WRMC Wochenreport (KW ${usedKw})`)
        .setDescription(
          `Preis: **${price}** • Cut: **${cut}%** • Mindest: **${min} Pulver**\n` +
          `\n${lines.length ? lines.join("\n") : "_Keine Daten für diese KW_"}`
        )
        .addFields(
          { name: "Summe (Brutto)", value: money(totalGross), inline: true },
          { name: "Summe Schwarzgeld", value: money(totalSchwarz), inline: true },
          { name: "Summe Auszahlung (Netto)", value: money(totalNet), inline: true },
          { name: "Auszahlbares Pulver", value: money(totalPayoutablePulver), inline: true }
        )
        .setFooter({ text: `Ausgelöst von: ${actorName}` });

      const ok = await sendReportToChannel(i.guild, embed);
      if (!ok) return i.editReply("❌ Konnte nicht in #lager-reports posten (Channel ID/Rechte prüfen).");

      return i.editReply("✅ Report wurde in **#lager-reports** gepostet.");
    }

    /* ===== AUSBEZAHLT NUR ADMIN CHANNEL ===== */
    if (sub === "ausbezahlt") {
      if (i.channelId !== ADMIN_CHANNEL_ID) {
        return i.editReply("❌ Dieser Befehl nur im **#lager-admin** Kanal.");
      }

      const targetUser = i.options.getUser("user", true);
      const betrag = i.options.getInteger("betrag") || 0;

      const targetName = getBestName(i, targetUser);

      const result = await post({
        action: "addTransaction",
        discordId: targetUser.id,
        name: targetName,
        channel: i.channel?.name || i.channelId,
        type: "PAID",
        amount: betrag,
        meta: { paidBy: actorName }
      });

      if (!result.ok) return i.editReply(`❌ Sheet Fehler: ${result.error}`);

      await post({ action: "writeWeeklySummary" });

      return i.editReply(`✅ Ausbezahlt markiert: **${targetName}**`);
    }

    /* ===== NORMALE LAGER CHANNELS ===== */
    if (!ROUTE_CHANNEL_IDS.includes(i.channelId)) {
      return i.editReply("❌ Nur in Lager-Kanälen erlaubt.");
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

    if (!type) return i.editReply("❌ Ungültiger Subcommand.");

    const result = await post({
      action: "addTransaction",
      discordId: i.user.id,
      name: actorName,
      channel: i.channel?.name || i.channelId,
      type,
      amount
    });

    if (!result.ok) return i.editReply(`❌ Sheet Fehler: ${result.error}`);

    await post({ action: "writeWeeklySummary" });

    return i.editReply(`✅ Gebucht: ${type} ${amount}`);
  } catch (err) {
    console.error(err);
    const msg = `❌ Bot Fehler: ${String(err).slice(0, 1500)}`;
    if (i.deferred || i.replied) return i.editReply(msg);
    return i.reply({ content: msg, ephemeral: true });
  }
});

/* ========= WEEKLY ROLLOVER ========= */
cron.schedule("5 0 * * 1", async () => {
  try {
    await post({ action: "rolloverWeek" });

    const ch = await client.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
    if (ch) ch.send("📦 Wochenarchiv automatisch erstellt.");

    console.log("Woche archiviert");
  } catch (e) {
    console.error("Rollover Fehler", e);
  }
}, { timezone: "Europe/Zurich" });

client.once("ready", () => {
  console.log(`🤖 Lagerbot online als ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
