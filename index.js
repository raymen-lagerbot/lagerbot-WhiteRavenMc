require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SHEET_URL = process.env.SHEET_URL;
const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName("lager")
    .setDescription("Buchung ins Lager")
    .addStringOption(o => o.setName("aktion").setDescription("rein/raus").setRequired(true))
    .addStringOption(o => o.setName("item").setDescription("Injektion/Blaues").setRequired(true))
    .addIntegerOption(o => o.setName("menge").setDescription("Menge").setRequired(true)),

  new SlashCommandBuilder()
    .setName("auswertung")
    .setDescription("Zeigt die Auswertung einer Woche")
    .addStringOption(o => o.setName("woche").setDescription("z.B. 2026-07").setRequired(false)),

  new SlashCommandBuilder()
    .setName("ausbezahlt")
    .setDescription("Markiert einen User als ausbezahlt")
    .addStringOption(o => o.setName("woche").setDescription("2026-07").setRequired(true))
    .addStringOption(o => o.setName("user").setDescription("z.B. Raymen").setRequired(true))
].map(c => c.toJSON());

async function deployCommands() {
  const rest = new REST({version:"10"}).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID), {body:commands});
  console.log("✅ Commands deployed");
}

async function sheetPost(body) {
  const res = await fetch(SHEET_URL, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch (e) { throw new Error(`Sheet-Antwort kein JSON: ${text}`); }

  if (!res.ok || json.status !== "ok") {
    throw new Error(`Sheet Fehler: ${JSON.stringify(json)}`);
  }
  return json;
}

async function sheetGetReport(week) {
  const url = new URL(SHEET_URL);
  url.searchParams.set("action","report");
  if (week) url.searchParams.set("week",week);

  const res = await fetch(url.toString());
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch (e) { throw new Error(`Report kein JSON: ${text}`); }

  if (!res.ok || json.status !== "ok") {
    throw new Error(`Report Fehler: ${JSON.stringify(json)}`);
  }
  return json.report;
}

client.once("ready", () => {
  console.log(`Bot Online: ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({content:"❌ Nur im erlaubten Kanal nutzbar.", ephemeral:true});
  }

  try {
    if (interaction.commandName === "lager") {
      const aktion = interaction.options.getString("aktion",true);
      const item = interaction.options.getString("item",true);
      const menge = interaction.options.getInteger("menge",true);

      const out = await sheetPost({
        user:interaction.user.username,
        userid:interaction.user.id,
        action:aktion,
        item,
        menge,
        server:interaction.guild?.name||"",
        channel:interaction.channel?.name||""
      });

      return interaction.reply({content:`✅ Gebucht: ${aktion} ${item} ${menge}`,ephemeral:true});
    }

    if (interaction.commandName === "auswertung") {
      const week = interaction.options.getString("woche",false) || "";
      const report = await sheetGetReport(week);

      if (!report.rows.length) {
        return interaction.reply({content:`ℹ️ Keine Daten für Woche ${report.week}`,ephemeral:true});
      }

      const lines = report.rows.map((r,i)=>`${i+1}. ${r.user} | Injektion:${r.injektion} Blaues:${r.blaues} | Betrag:${r.betrag}`);
      return interaction.reply({content:`📊 Woche ${report.week}\n${lines.join("\n")}`,ephemeral:true});
    }

    if (interaction.commandName === "ausbezahlt") {
      const week = interaction.options.getString("woche",true);
      const user = interaction.options.getString("user",true);

      const out = await sheetPost({
        action:"paid",
        week,
        user,
        paid_by:interaction.user.username
      });

      return interaction.reply({content:`✅ Ausbezahlt: ${user} (${week})`,ephemeral:true});
    }
  } catch(err) {
    return interaction.reply({content:"❌ Fehler: "+err.message,ephemeral:true});
  }
});

(async ()=> {
  await deployCommands();
  await client.login(DISCORD_TOKEN);
})();
