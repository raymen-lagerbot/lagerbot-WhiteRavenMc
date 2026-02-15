require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const SHEETS_URL = process.env.SHEETS_WEBAPP_URL;
const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // optional

function currentWeekId() {
  // Muss zu deinem Sheets weekId_ passen: yyyy-ww
  const now = new Date();
  const year = now.getFullYear();
  // ISO week quick (good enough for our use):
  const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  return { ok: res.ok, text };
}

async function getJSON(url) {
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, data };
}

client.once('ready', () => console.log(`✅ Bot online als ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Kanal-Gate (nur Lager/Reports im route-buchungen)
  if (ALLOWED_CHANNEL_ID && interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({ content: "❌ Bitte nur im Kanal #route-buchungen benutzen.", ephemeral: true });
  }

  // /lager
  if (interaction.commandName === "lager") {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString('aktion');
    const item = interaction.options.getString('item');
    const menge = interaction.options.getInteger('menge');

    const userName = interaction.member?.displayName || interaction.user.username;

    const payload = {
      user: userName,
      userid: interaction.user.id,
      action,
      item,
      menge,
      server: interaction.guild?.name || "",
      channel: interaction.channel?.name || ""
    };

    try {
      const r = await postJSON(SHEETS_URL, payload);
      if (!r.ok) throw new Error(r.text);

      await interaction.channel.send(`✅ ${userName}: ${action} ${menge} × ${item}`);
      return interaction.editReply(`✅ Gebucht: ${menge} × ${item} (${action})`);
    } catch (e) {
      console.error(e);
      return interaction.editReply("❌ Fehler beim Buchen (Logs prüfen).");
    }
  }

  // /wochenreport
  if (interaction.commandName === "wochenreport") {
    await interaction.deferReply({ ephemeral: false });

    const week = interaction.options.getString('week') || currentWeekId();
    const url = `${SHEETS_URL}?action=report&week=${encodeURIComponent(week)}`;

    try {
      const r = await getJSON(url);
      if (!r.ok || r.data.status !== "ok") throw new Error(JSON.stringify(r.data));

      const rows = r.data.report.rows || [];
      if (!rows.length) return interaction.editReply(`📭 Keine Daten für Woche **${week}**.`);

      const top = rows.slice(0, 10)
        .map((x, i) => `${i + 1}. **${x.user}** — Injektion: ${x.injektion} | Blaues: ${x.blaues} | Betrag: ${x.betrag}`)
        .join("\n");

      return interaction.editReply(`📊 **Wochenreport ${week}**\n\n${top}`);
    } catch (e) {
      console.error(e);
      return interaction.editReply("❌ Report Fehler (Logs prüfen).");
    }
  }

  // /ausbezahlt
  if (interaction.commandName === "ausbezahlt") {
    // Optional: nur Admin Rolle
    if (ADMIN_ROLE_ID && !interaction.member?.roles?.cache?.has(ADMIN_ROLE_ID)) {
      return interaction.reply({ content: "❌ Keine Berechtigung.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getString('user');
    const week = interaction.options.getString('week') || currentWeekId();

    try {
      const r = await postJSON(SHEETS_URL, {
        action: "paid",
        week,
        user,
        paid_by: interaction.member?.displayName || interaction.user.username
      });

      if (!r.ok) throw new Error(r.text);

      return interaction.editReply(`✅ Markiert als ausbezahlt: **${user}** (Woche ${week})`);
    } catch (e) {
      console.error(e);
      return interaction.editReply("❌ Konnte nicht markieren (Name/Woche prüfen).");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
