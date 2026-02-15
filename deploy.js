require("dotenv").config();
const {REST, Routes, SlashCommandBuilder} = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder().setName("lager").setDescription("Bucht in Sheet")
    .addStringOption(o=>o.setName("aktion").setDescription("rein/raus").setRequired(true))
    .addStringOption(o=>o.setName("item").setDescription("Item").setRequired(true))
    .addIntegerOption(o=>o.setName("menge").setDescription("Menge").setRequired(true)),

  new SlashCommandBuilder().setName("auswertung").setDescription("Wochen Report")
    .addStringOption(o=>o.setName("woche").setDescription("Editor z.B. 2026-07")),

  new SlashCommandBuilder().setName("ausbezahlt").setDescription("Markiert Paid")
    .addStringOption(o=>o.setName("woche").setDescription("z.B. 2026-07").setRequired(true))
    .addStringOption(o=>o.setName("user").setDescription("z.B. Raymen").setRequired(true)),
].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(DISCORD_TOKEN);

(async()=>{
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID), {body:commands});
    console.log("⚡ Commands deployed");
  } catch(err) {
    console.error(err);
  }
})();
