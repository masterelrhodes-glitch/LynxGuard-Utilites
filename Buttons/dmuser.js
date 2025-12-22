const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const mongoose = require('mongoose');

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
  customID: 'dmuser',
  skipSplit: false,
  async execute(interaction, client, args) {
    try {
      const targetUserId = args && args[0] ? args[0] : null;
      
      if (!targetUserId) {
        return await interaction.reply({
          content: 'Unable to identify the application user.',
          flags: MessageFlags.Ephemeral
        });
      }

      const conn = await getApplicationConnection();
      const Application = conn.model('Application', applicationSchema);
      
      const application = await Application.findOne({ 
        threadId: interaction.channel.id 
      });

      if (!application) {
        return await interaction.reply({
          content: 'Could not find application data.',
          flags: MessageFlags.Ephemeral
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`dmusermodal_${targetUserId}_${application.applicationId}_${interaction.channel.id}`)
        .setTitle('Send Message to Applicant');

      const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('Your Message')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type your message to the applicant...')
        .setRequired(true)
        .setMaxLength(2000);

      const actionRow = new ActionRowBuilder().addComponents(messageInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('[DM_USER] Error:', error);
      await interaction.reply({
        content: 'An error occurred while trying to DM the user.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
};