const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

const STAGED_TAG_ID = '1451815623280562246';
const PENDING_TAG_ID = '1451815611419197502';

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

let applicationConnection = null;

async function getApplicationConnection() {
  if (!applicationConnection || applicationConnection.readyState === 0) {
    applicationConnection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  }
  return applicationConnection;
}

module.exports = {
  customID: 'stageappmodal',
  skipSplit: false,
  async execute(interaction, client, args) {
    try {
      const targetUserId = args && args[0] ? args[0] : null;
      const action = args && args[1] ? args[1] : null;
      
      if (!targetUserId || !action) {
        return await interaction.reply({
          content: 'Invalid application data.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      console.log('[STAGE_APP_MODAL] Modal submitted by:', interaction.user.id);
      console.log('[STAGE_APP_MODAL] Target user ID:', targetUserId);
      console.log('[STAGE_APP_MODAL] Action:', action);

      const reason = interaction.fields.getTextInputValue('reason') || null;

      console.log('[STAGE_APP_MODAL] Reason:', reason || 'No reason provided');

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

      console.log('[STAGE_APP_MODAL] Found application:', application.applicationId);

      const newStatus = action === 'accept' ? 'staged accepted' : 'staged denied';
      
      application.status = newStatus;
      application.applicationReviewer = interaction.user.id;
      application.dateReviewed = new Date();
      application.applicationNotes = reason;

      await application.save();

      console.log('[STAGE_APP_MODAL] Application updated in database');

      const thread = interaction.channel;
      const currentTags = thread.appliedTags || [];
      const newTags = currentTags.filter(tag => tag !== PENDING_TAG_ID);
      
      if (!newTags.includes(STAGED_TAG_ID)) {
        newTags.push(STAGED_TAG_ID);
      }

      await thread.setAppliedTags(newTags);

      console.log('[STAGE_APP_MODAL] Thread tags updated');

      const outcome = action === 'accept' ? 'accepted' : 'denied';
      let messageContent = `Staged to be **${outcome}** by: ${interaction.user}`;
      
      if (reason) {
        messageContent += `\nReason: ${reason}`;
      }

      await thread.send(messageContent);

      console.log('[STAGE_APP_MODAL] Response sent in thread');

      await interaction.editReply({
        content: `Application has been staged as **${outcome}**.`,
        flags: MessageFlags.Ephemeral
      });

      console.log('[STAGE_APP_MODAL] Stage process complete');

    } catch (error) {
      console.error('[STAGE_APP_MODAL] Error staging application:', error);
      console.error('[STAGE_APP_MODAL] Error stack:', error.stack);
      
      await interaction.editReply({
        content: 'An error occurred while staging the application. Please contact an administrator.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
};