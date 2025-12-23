const { 
  ModalBuilder, 
  LabelBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  duid: String,
  ruid: String
});

const ticketSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  ticketId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  ticketType: { type: String, required: true },
  reason: { type: String, required: true },
  dateMade: { type: Date, default: Date.now },
  dateClosed: { type: Date, default: null },
  closedBy: { type: String, default: null },
  closureReason: { type: String, default: null },
  transcriptLink: { type: String, default: null }
});

async function connectVerificationDB() {
  const conn = mongoose.createConnection(process.env.MONGO_URI2);
  return conn;
}

async function connectMainDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);

module.exports = {
  customID: 'assistance_button',
  
  async execute(interaction, client) {
    console.log('[ASSISTANCE] Button clicked, checking requirements...');

    try {
      const verificationConn = await connectVerificationDB();
      const VerificationModel = verificationConn.model('verification', verificationSchema);
      
      const userVerification = await VerificationModel.findOne({ duid: interaction.user.id });
      await verificationConn.close();

      if (!userVerification || !userVerification.ruid) {
        return await interaction.reply({
          content: 'You must have a linked Roblox account to open a ticket. Please verify your account first.',
          ephemeral: true
        });
      }

      console.log('[ASSISTANCE] User has linked Roblox account:', userVerification.ruid);

      await connectMainDB();

      const existingTickets = await Ticket.find({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        dateClosed: null
      });

      if (existingTickets.length > 0) {
        const ticketTypes = existingTickets.map(t => t.ticketType);
        const ticketChannels = existingTickets.map(t => `<#${t.channelId}>`).join(', ');
        
        return await interaction.reply({
          content: `You already have an open ticket: ${ticketChannels}\nPlease close your existing ticket before opening a new one.`,
          ephemeral: true
        });
      }

      console.log('[ASSISTANCE] No existing tickets found, showing modal...');

      const modal = new ModalBuilder()
        .setCustomId('assistance_modal')
        .setTitle('Request Assistance');

      const ticketTypeSelect = new StringSelectMenuBuilder()
        .setCustomId('ticket_type')
        .setPlaceholder('Select a support type')
        .setRequired(true)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Billing Support')
            .setDescription('Issues related to billing and payments')
            .setValue('billing'),
          new StringSelectMenuOptionBuilder()
            .setLabel('General Support')
            .setDescription('General questions and assistance')
            .setValue('general'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Developer Support')
            .setDescription('Technical and development support')
            .setValue('developer')
        );

      const ticketTypeLabel = new LabelBuilder()
        .setLabel('Ticket Type')
        .setDescription('Select the type of support you need')
        .setStringSelectMenuComponent(ticketTypeSelect);

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason_input')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Please describe your issue in detail...')
        .setMinLength(50)
        .setRequired(true);

      const reasonLabel = new LabelBuilder()
        .setLabel('Reason for Request')
        .setDescription('Explain why you need assistance (minimum 50 characters)')
        .setTextInputComponent(reasonInput);

      const serverIdInput = new TextInputBuilder()
        .setCustomId('server_id_input')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your server ID')
        .setMinLength(18)
        .setMaxLength(19)
        .setRequired(true);

      const serverIdLabel = new LabelBuilder()
        .setLabel('Server ID')
        .setDescription('Your Discord server ID (18-19 characters)')
        .setTextInputComponent(serverIdInput);

      modal.addLabelComponents(ticketTypeLabel, reasonLabel, serverIdLabel);

      await interaction.showModal(modal);
      
      console.log('[ASSISTANCE] Modal shown successfully!');

    } catch (error) {
      console.error('[ASSISTANCE] Error:', error);
      await interaction.reply({
        content: 'An error occurred while processing your request. Please try again later.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};