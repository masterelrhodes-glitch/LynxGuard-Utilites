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
  status: { type: String, enum: ['not reviewed', 'staged', 'accepted', 'denied'], default: 'not reviewed' },
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

let applicationConnection = null;

async function getApplicationConnection() {
  if (!applicationConnection || applicationConnection.readyState === 0) {
    applicationConnection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  }
  return applicationConnection;
}

module.exports = {
  customID: 'deleteappmodal',
  skipSplit: false,
  async execute(interaction, client, args) {
    try {
      const targetUserId = args && args[0] ? args[0] : null;
      
      if (!targetUserId) {
        return await interaction.reply({
          content: 'Invalid application target.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      console.log('[DELETE_APP_MODAL] Modal submitted by:', interaction.user.id);
      console.log('[DELETE_APP_MODAL] Target user ID:', targetUserId);

      const reason = interaction.fields.getTextInputValue('reason');

      console.log('[DELETE_APP_MODAL] Deletion reason:', reason);

      const threadId = interaction.channel.id;

      const conn = await getApplicationConnection();
      const Application = conn.model('Application', applicationSchema);

      const application = await Application.findOne({ threadId: threadId });

      if (!application) {
        return await interaction.editReply({
          content: 'Application not found in database.',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log('[DELETE_APP_MODAL] Found application:', application.applicationId);

      const targetUser = await client.users.fetch(application.discordUserId).catch(() => null);
      const targetUsername = targetUser ? targetUser.username : application.discordUsername;

      await Application.deleteOne({ threadId: threadId });
      console.log('[DELETE_APP_MODAL] Application deleted from database');

      await interaction.channel.delete('Application deleted by moderator');
      console.log('[DELETE_APP_MODAL] Thread deleted');

      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      
      if (logChannel) {
        const embed = {
          author: {
            name: interaction.user.username,
            icon_url: interaction.user.displayAvatarURL({ dynamic: true })
          },
          title: 'Application Deleted',
          description: `${interaction.user} **deleted** ${targetUser || targetUsername}'s application.\n### Reason:\n\`\`\`${reason}\`\`\``,
          color: 16730441
        };

        await logChannel.send({ embeds: [embed] });
        console.log('[DELETE_APP_MODAL] Log message sent');
      }

   

    } catch (error) {
      console.error('[DELETE_APP_MODAL] Error deleting application:', error);
      console.error('[DELETE_APP_MODAL] Error stack:', error.stack);
      
      await interaction.editReply({
        content: 'An error occurred while deleting the application. Please contact an administrator.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
};