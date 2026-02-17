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

/* ✅ HIER DEINE ROLLEN IDs EINTRAGEN */
const ADMIN_ROLE_IDS = [
  "ROLE_ID_LEITUNG",
  "ROLE_ID_BUCHHALTUNG"
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* ========= APPS SCRIPT API ========= */

async function post(payload) {
  const res = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: process.env.API_TOKEN, ...payload })
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok:false, error:text }; }
}

async function getState() {
  const r = await post({ action:"getBotState" });
  return r.ok ? r.data : { paused:false };
}

/* ========= HELPERS ========= */

function hasAdminRole(i) {
  const roles = i.member?.roles?.cache;
  if (!roles) return false;
  return roles.some(r => ADMIN_ROLE_IDS.includes(r.id));
}

function getName(i,u){
  if(i.user.id===u.id)
    return i.member?.nickname || u.globalName || u.username;
  const m=i.guild.members.cache.get(u.id);
  return m?.nickname || u.globalName || u.username;
}

function money(n){ return Number(n||0).toLocaleString("de-CH"); }

function chunk(a,s){const o=[];for(let i=0;i<a.length;i+=s)o.push(a.slice(i,i+s));return o;}

/* ========= PANEL ========= */

function panelEmbed(state){
  return new EmbedBuilder()
    .setTitle("🧾 Wochenabschluss Panel")
    .setDescription(
      state.paused
        ? `⏸ Prüfmodus aktiv\nGrund: ${state.reason||"-"}`
        : "✅ Normalbetrieb"
    );
}

function panelButtons(state){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pause")
      .setLabel("⏸ Pause")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.paused),

    new ButtonBuilder()
      .setCustomId("resume")
      .setLabel("▶ Weiter")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("final")
      .setLabel("✅ Abschluss + Neustart")
      .setStyle(ButtonStyle.Success)
  );
}

/* ========= INTERACTIONS ========= */

client.on("interactionCreate", async i=>{
try{

/* ---------- BUTTONS ---------- */

if(i.isButton()){
  if(i.channelId!==ADMIN_CHANNEL_ID)
    return i.reply({content:"❌ Nur #lager-admin",ephemeral:true});
  if(!hasAdminRole(i))
    return i.reply({content:"❌ Keine Berechtigung",ephemeral:true});

  await i.deferReply({ephemeral:true});

  if(i.customId==="pause"){
    await post({action:"setBotPaused",paused:true,reason:"Prüfung"});
  }

  if(i.customId==="resume"){
    await post({action:"setBotPaused",paused:false,reason:""});
  }

  if(i.customId==="final"){
    await post({action:"rolloverWeek"});
    await post({action:"setBotPaused",paused:false,reason:""});
  }

  const st=await getState();
  await i.message.edit({
    embeds:[panelEmbed(st)],
    components:[panelButtons(st)]
  });

  return i.editReply("✅ OK");
}

/* ---------- COMMANDS ---------- */

if(!i.isChatInputCommand()) return;
if(i.commandName!=="lager") return;

await i.deferReply({ephemeral:true});

const sub=i.options.getSubcommand(false);
const admin=hasAdminRole(i);
const state=await getState();

/* Pause Block */
if(state.paused && !admin)
  return i.editReply("⏸ Prüfmodus aktiv");

/* Admin only */
if(["panel","report","config","ausbezahlt"].includes(sub)){
  if(i.channelId!==ADMIN_CHANNEL_ID)
    return i.editReply("❌ Nur #lager-admin");
  if(!admin)
    return i.editReply("❌ Keine Berechtigung");
}

/* PANEL */
if(sub==="panel"){
  const st=await getState();
  await i.channel.send({
    embeds:[panelEmbed(st)],
    components:[panelButtons(st)]
  });
  return i.editReply("✅ Panel gepostet");
}

/* CONFIG */
if(sub==="config"){
  const c=await post({action:"getConfig"});
  return i.editReply(JSON.stringify(c.data,null,2));
}

/* REPORT */
if(sub==="report"){
  const s=await post({action:"getWeeklySummary"});
  if(!s.ok) return i.editReply("Sheet Fehler");

  const lines=s.data.map(r=>
    `${r.name} • Netto ${money(r.payout_net)}`
  );

  const parts=chunk(lines,25);
  const ch=await i.guild.channels.fetch(REPORT_CHANNEL_ID);

  for(const p of parts){
    await ch.send({content:p.join("\n")});
  }

  return i.editReply("✅ Report gesendet");
}

/* AUSBEZAHLT */
if(sub==="ausbezahlt"){
  const u=i.options.getUser("user");
  await post({
    action:"addTransaction",
    discordId:u.id,
    name:getName(i,u),
    channel:i.channel.name,
    type:"PAID",
    amount:0
  });
  await post({action:"writeWeeklySummary"});
  return i.editReply("✅ markiert");
}

/* NORMAL BUCHUNGEN */

if(!ROUTE_CHANNEL_IDS.includes(i.channelId))
  return i.editReply("❌ falscher Channel");

const menge=i.options.getInteger("menge");
const typ=i.options.getString("typ");

let type=null;
if(sub==="blue-rein") type="PULVER_IN";
if(sub==="blue-raus") type="PULVER_OUT";
if(sub==="injektion-rein") type="INJ_IN";
if(sub==="injektion-raus") type="INJ_OUT";
if(sub==="wochen-abgabe"){
  if(typ==="A") type="WOCHENABGABE_A";
  if(typ==="B") type="WOCHENABGABE_B";
  if(typ==="X") type="BEFREIT_X";
}

await post({
  action:"addTransaction",
  discordId:i.user.id,
  name:getName(i,i.user),
  channel:i.channel.name,
  type,
  amount:menge||0
});

await post({action:"writeWeeklySummary"});
return i.editReply("✅ gebucht");

}catch(e){
  console.error(e);
  if(i.deferred) return i.editReply("❌ Fehler");
}});

/* ========= AUTO ARCHIV ========= */

cron.schedule("5 0 * * 1", async()=>{
  await post({action:"rolloverWeek"});
},{timezone:"Europe/Zurich"});

client.once("ready",()=>console.log("🤖 LagerBot online"));
client.login(process.env.DISCORD_TOKEN);
