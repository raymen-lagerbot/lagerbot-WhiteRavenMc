require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ---------- Sheets Sender ----------
async function sendToSheets(data) {
  console.log("Sende an Sheets:", data);

  const res = await fetch(process.env.SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const text = await res.text();
  console.log("Sheets Antwort:", text);
}

// ---------- Ready ----------
client.once(Events.ClientReady, () => {
  console.log(`Bot online als ${client.user.tag}`);
});

// ---------- Slash Command Handler ----------
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== "lager") return;

  try {
    // ❗ wichtig gegen Unknown interaction
    await i.deferReply({ flags: 64 });

    const action = i.options.getString("aktion");
    const item = i.options.getString("item");
    const menge = i.options.getInteger("menge");

    const user = i.user.username;
    const userid = i.user.id;

    // -------- Sheets senden --------
   await sendToSheets({
  user: i.member?.displayName || i.user.username,
  userid: i.user.id,
  action,
  item,
  menge
});



    // -------- Channel posten --------
    const channelId =
      action === "rein"
        ? process.env.CHANNEL_EINGANG_ID
        : process.env.CHANNEL_AUSGANG_ID;

    const ch = await client.channels.fetch(channelId);

    await ch.send(
      `${action === "rein" ? "+" : "-"}${menge} ${item} (${user})`
    );

    // -------- Antwort --------
    await i.editReply("Gebucht ✅");

  } catch (err) {
    console.error("Fehler:", err);
    if (i.deferred) {
      await i.editReply("❌ Fehler beim Buchen");
    }
  }
});

// ---------- Start ----------
client.login(process.env.DISCORD_TOKEN);
