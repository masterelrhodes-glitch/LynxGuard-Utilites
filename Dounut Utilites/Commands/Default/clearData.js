const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const HR_ROLE = '1442346970416156812';

let db;
async function getDb() {
  if (db) return db;
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  return db;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear-data')
    .setDescription('Dev only')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('collection')
        .setDescription('Collection to wipe')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    if (!interaction.member.roles.cache.has(HR_ROLE)) return interaction.respond([]);
    const focused = interaction.options.getFocused();
    const database = await getDb();
    const cols = await database.listCollections().toArray();
    const choices = cols
      .map(c => ({ name: c.name, value: c.name }))
      .filter(c => c.name.toLowerCase().startsWith(focused.toLowerCase()))
      .slice(0, 25);
    return interaction.respond(choices);
  },

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(HR_ROLE))
      return interaction.reply({ content: 'Dev only', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const colName = interaction.options.getString('collection', true);
    const database = await getDb();
    const col = database.collection(colName);

    try {
      const { deletedCount } = await col.deleteMany({});
      return interaction.editReply({
        content: `Cleared \`${colName}\` – ${deletedCount} documents removed.`
      });
    } catch (err) {
      return interaction.editReply({
        content: `Failed to clear \`${colName}\`: ${err.message}`
      });
    }
  },
};