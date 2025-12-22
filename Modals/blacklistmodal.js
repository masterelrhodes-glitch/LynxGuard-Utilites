const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

const LOG_CHANNEL_ID = '1451815045129437195';

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true },
  threadId: { type: String, required: true },
  discordUserId: { type: String, required: true },
  discordUsername: { type: String, required: true },
  robloxUserId: { type: String, required: true },
  robloxUsername: { type: String, required: true },
  status: { type: String, enum: ['not reviewed', 'staged accepted', 'staged denied', 'accepted', 'denied'], default: 'not reviewed' },
  answers: {
    pastSupport: String,
    serversWorked: String,
    discordJsKnowledge: String,
    question3: String,
    question4: String,
    question5: String,
    question6: String,
    question7: String
  },
  applicationReviewer: { type: String, default: null },
  dateReviewed: { type: Date, default: null },
  applicationNotes: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'applications', timestamps: true });

const blacklistSchema = new mongoose.Schema({
  discordUserId: { type: String, required: true, unique: true },
  discordUsername: { type: String, required: true },
  blacklistedBy: { type: String, required: true },
  blacklistedByUsername: { type: String, required: true },
  reason: { type: String, default: 'No reason provided' },
  blacklistedAt: { type: Date, default: Date.now }
}, { collection: 'blacklist', timestamps: true });

let applicationConnection = null;

async function getApplicationConnection() {
  if (!applicationConnection || applicationConnection.readyState === 0) {
    applicationConnection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  }
  return applicationConnection;
}

module.exports = {
  customID: 'blacklistmodal',
  skipSplit: false,
  async execute(interaction, client, args) {
    try {
      const targetUserId = args && args[0] ? args[0] : null;
      
      if (!targetUserId) {
        return await interaction.reply({
          content: 'Invalid user target.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      console.log('[BLACKLIST_MODAL] Modal submitted by:', interaction.user.id);
      console.log('[BLACKLIST_MODAL] Target user ID:', targetUserId);

      const reason = interaction.fields.getTextInputValue('reason');

      console.log('[BLACKLIST_MODAL] Blacklist reason:', reason);

      const threadId = interaction.channel.id;

      const conn = await getApplicationConnection();
      const Application = conn.model('Application', applicationSchema);
      const Blacklist = conn.model('Blacklist', blacklistSchema);

      const application = await Application.findOne({ threadId: threadId });

      if (!application) {
        return await interaction.editReply({
          content: 'Application not found in database.',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log('[BLACKLIST_MODAL] Found application:', application.applicationId);

      const targetUser = await client.users.fetch(application.discordUserId).catch(() => null);
      const targetUsername = targetUser ? targetUser.username : application.discordUsername;

      const existingBlacklist = await Blacklist.findOne({ discordUserId: application.discordUserId });
      
      if (existingBlacklist) {
        return await interaction.editReply({
          content: 'This user is already blacklisted.',
          flags: MessageFlags.Ephemeral
        });
      }

      const newBlacklist = new Blacklist({
        discordUserId: application.discordUserId,
        discordUsername: targetUsername,
        blacklistedBy: interaction.user.id,
        blacklistedByUsername: interaction.user.username,
        reason: reason
      });

      await newBlacklist.save();

      console.log('[BLACKLIST_MODAL] User blacklisted in database');

      await Application.deleteOne({ threadId: threadId });
      console.log('[BLACKLIST_MODAL] Application deleted from database');

      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      
      if (logChannel) {
        const embed = {
          author: {
            name: interaction.user.username,
            icon_url: interaction.user.displayAvatarURL({ dynamic: true })
          },
          title: 'User Blacklisted',
          description: `${interaction.user} **blacklisted** ${targetUser || targetUsername}.\n### Reason:\n\`\`\`${reason}\`\`\``,
          color: 16730441
        };

        await logChannel.send({ embeds: [embed] });
        console.log('[BLACKLIST_MODAL] Log message sent');
      }

      await interaction.channel.delete('User blacklisted');
      console.log('[BLACKLIST_MODAL] Thread deleted');


    } catch (error) {
      console.error('[BLACKLIST_MODAL] Error blacklisting user:', error);
      console.error('[BLACKLIST_MODAL] Error stack:', error.stack);
      
      await interaction.editReply({
        content: 'An error occurred while blacklisting the user. Please contact an administrator.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
};