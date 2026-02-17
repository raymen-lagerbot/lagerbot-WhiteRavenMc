require("dotenv").config();
const {
  Client, GatewayIntentBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const cron = require("node-cron");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* ========= CONFIG ========= */

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

// ⬇️ Anpassbar: nur diese Rollen dürfen im Prüfmodus weiter buchen / report / config / ausbezahlt
const ADMIN_ROLES = ["President", "Vice President", "Treasurer", "MC-Leitung"];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function post(payload) {
  const res = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: process.env.API_TOKEN, ...payload })
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok: false, error: `AppsScript kein JSON: ${text.slice(0, 200)}` }; }
}

function hasAnyRole(i, roleNames) {
  const roles = i.member?.roles?.cache;
  if (!roles) return false;
  const lower = roleNames.map(r => r.toLowerCase());
  return roles.some(r => lower.includes(String(r.name).toLowerCase()));
}

function getBestName(i, user) {
  if (!user) return "Unknown";
  if (i.user?.id === user.id) {
    return i.member?.nickname || i.user.globalName || i.user.username;
  }
  const cached = i.guild?.members?.cache?.get(user.id);
  return cached?.nickname || user.globalName || user.username;
}

function money(n) {
  return Number(n || 0).toLocaleString("de-CH");
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function isPaused() {
  const s = await post({ action: "getBotState" });
  if (!s.ok) return { paused: false, reason: "" }; // fallback: lieber nicht blocken
  return s.data || { paused: false, reason: "" };
}

/* ========= BUTTON PANEL ========= */

function buildPanelEmbed(state) {
  const paused = !!state?.paused;
  const reason = state?.reason ? `\nGrund: **${state.reason}**` : "";
  return new EmbedBuilder()
    .setTitle("🧾 WRMC Wochenabschluss Panel")
    .setDescription(
      paused
        ? `Status: **⏸ Prüfmodus aktiv** (Buchungen nur Admin/Buchhaltung).${reason}`
        : `Status: **✅ Normalbetrieb** (alle können buchen).`
    );
}

function buildPanelButtons(state) {
  const paused = !!state?.paused;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lager_pause")
      .setLabel(paused ? "⏸ Prüfmodus läuft" : "⏸ Prüfmodus (Pause)")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(paused),

    new ButtonBuilder()
      .setCustomId("lager_finalize_restart")
      .setLabel("✅ Abschluss & Neustart")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("lager_resume")
      .setLabel("▶️ Weiter (Pause aus)")
      .setStyle(ButtonStyle.Primary)
  );
}

/* ========= INTERACTIONS ========= */

client.on("interactionCreate", async (i) => {
  try {
    /* ===== BUTTONS ===== */
    if (i.isButton()) {
      if (i.channelId !== ADMIN_CHANNEL_ID) {
        return i.reply({ content: "❌ Buttons nur im #lager-admin.", ephemeral: true });
      }
      if (!hasAnyRole(i, ADMIN_ROLES)) {
        return i.reply({ content: "❌ Keine Berechtigung (nur Leitung/Kasse).", ephemeral: true });
      }

      await i.deferReply({ ephemeral: true });

      if (i.customId === "lager_pause") {
        const r = await post({ action: "setBotPaused", paused: true, reason: "Prüfung / Abrechnung" });
        if (!r.ok) return i.editReply(`❌ Fehler: ${r.error}`);

        // Panel aktualisieren (edit original message)
        const st = await isPaused();
        await i.message.edit({ embeds: [buildPanelEmbed(st)], components: [buildPanelButtons(st)] });

        return i.editReply("✅ Prüfmodus aktiviert. Normale Member können nicht mehr buchen.");
      }

      if (i.customId === "lager_resume") {
        const r = await post({ action: "setBotPaused", paused: false, reason: "" });
        if (!r.ok) return i.editReply(`❌ Fehler: ${r.error}`);

        const st = await isPaused();
        await i.message.edit({ embeds: [buildPanelEmbed(st)], components: [buildPanelButtons(st)] });

        return i.editReply("✅ Prüfmodus deaktiviert. Normalbetrieb wieder aktiv.");
      }

      if (i.customId === "lager_finalize_restart") {
        // 1) Archiv erstellen
        const arch = await post({ action: "rolloverWeek" });
        if (!arch.ok) return i.editReply(`❌ Archiv Fehler: ${arch.error}`);

        // 2) Pause aus (neue Woche freigeben)
        const r = await post({ action: "setBotPaused", paused: false, reason: "" });
        if (!r.ok) return i.editReply(`❌ Pause Fehler: ${r.error}`);

        const st = await isPaused();
        await i.message.edit({ embeds: [buildPanelEmbed(st)], components: [buildPanelButtons(st)] });

        return i.editReply(`✅ Woche abgeschlossen & neu gestartet. Archiviert: KW **${arch.archivedKw ?? "?"}**`);
      }

      return i.editReply("❌ Unbekannter Button.");
    }

    /* ===== SLASH COMMANDS ===== */
    if (!i.isChatInputCommand()) return;
    if (i.commandName !== "lager") return;

    await i.deferReply({ ephemeral: true });

    const sub = i.options.getSubcommand(false);
    if (!sub) return i.editReply("❌ Subcommand fehlt.");

    const actorName = getBestName(i, i.user);
    const isAdmin = hasAnyRole(i, ADMIN_ROLES);

    // ✅ Sperrlogik: wenn Pause aktiv → nur Admins dürfen Buchungen
    const state = await isPaused();
    if (state.paused && !isAdmin) {
      // normale Member: alles blocken (auch Buchung in Lager-Channels)
      return i.editReply("⏸ **Prüfmodus aktiv** – bitte warten, Buchungen sind vorübergehend gesperrt.");
    }

    /* ===== Admin-only: config/report/ausbezahlt/panel ===== */
    const adminOnlySubs = new Set(["config", "report", "ausbezahlt", "panel"]);
    if (adminOnlySubs.has(sub)) {
      if (i.channelId !== ADMIN_CHANNEL_ID) {
        return i.editReply("❌ Bitte im **#lager-admin** verwenden.");
      }
      if (!isAdmin) {
        return i.editReply("❌ Keine Berechtigung (nur Leitung/Kasse).");
      }
    }

    /* ===== PANEL ===== */
    if (sub === "panel") {
      const st = await isPaused();
      const embed = buildPanelEmbed(st);
      const row = buildPanelButtons(st);

      // Panel Nachricht öffentlich im Admin-Channel posten
      await i.channel.send({ embeds: [embed], components: [row] });
      return i.editReply("✅ Panel wurde im **#lager-admin** gepostet.");
    }

    /* ===== CONFIG ===== */
    if (sub === "config") {
      const cfg = await post({ action: "getConfig" });
      if (!cfg.ok) return i.editReply(`❌ Sheet Fehler: ${cfg.error}`);

      return i.editReply(
        `⚙️ **Aktuelle Config**\n` +
        `• Preis pro Pulver: **${cfg.data?.PRICE_PER_PULVER ?? 225}**\n` +
        `• Schwarzgeld: **${cfg.data?.CUT_PERCENT ?? 20}%**\n` +
        `• Mindest-Abgabe: **${cfg.data?.MIN_ABGABE_PULVER ?? 1000} Pulver**`
      );
    }

    /* ===== REPORT ===== */
    if (sub === "report") {
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

      let totalNet = 0, totalSchwarz = 0, totalGross = 0, totalPayoutablePulver = 0;

      const allLines = rows
        .sort((a, b) => Number(b.payout_net || 0) - Number(a.payout_net || 0))
        .map(r => {
          totalNet += Number(r.payout_net || 0);
          totalSchwarz += Number(r.schwarzgeld_20 || 0);
          totalGross += Number(r.payout_gross || 0);
          totalPayoutablePulver += Number(r.payoutable_pulver || 0);

          const paid = r.paid ? "✅" : "⏳";
          const name = r.name || "Unbekannt";
          const abg = r.wochenabgabe || "-";
          const pPulver = money(r.payoutable_pulver || 0);
          const payoutNet = money(r.payout_net || 0);

          return `${paid} **${name}** • Abgabe: **${abg}** • Auszahlbar: **${pPulver}** • Netto: **${payoutNet}**`;
        });

      const parts = chunk(allLines.length ? allLines : ["_Keine Daten für diese KW_"], 25);
      const embeds = [];

      for (let p = 0; p < parts.length; p++) {
        const e = new EmbedBuilder()
          .setTitle(`📊 WRMC Wochenreport (KW ${usedKw})${parts.length > 1 ? ` • Teil ${p + 1}/${parts.length}` : ""}`)
          .setDescription(`Preis: **${price}** • Cut: **${cut}%** • Mindest: **${min}**\n\n${parts[p].join("\n")}`)
          .setFooter({ text: `Ausgelöst von: ${actorName}` });

        if (p === 0) {
          e.addFields(
            { name: "Summe Brutto", value: money(totalGross), inline: true },
            { name: "Summe Schwarzgeld", value: money(totalSchwarz), inline: true },
            { name: "Summe Netto", value: money(totalNet), inline: true },
            { name: "Auszahlbares Pulver", value: money(totalPayoutablePulver), inline: true }
          );
        }
        embeds.push(e);
      }

      const ch = await i.guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
      if (!ch) return i.editReply("❌ #lager-reports nicht gefunden (ID/Rechte prüfen).");

      for (const e of embeds) await ch.send({ embeds: [e] });

      return i.editReply("✅ Report wurde in **#lager-reports** gepostet.");
    }

    /* ===== AUSBEZAHLT ===== */
    if (sub === "ausbezahlt") {
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

    /* ===== NORMALE BUCHUNGEN ===== */
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

/* ========= WEEKLY AUTO ARCHIVE ========= */
cron.schedule("5 0 * * 1", async () => {
  try {
    await post({ action: "rolloverWeek" });
    const ch = await client.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
    if (ch) ch.send("📦 Wochenarchiv automatisch erstellt.");
  } catch (e) {
    console.error("Rollover Fehler", e);
  }
}, { timezone: "Europe/Zurich" });

client.once("ready", () => console.log(`🤖 Lagerbot online als ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
