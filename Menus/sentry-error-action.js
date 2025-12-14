const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: (id) => id.startsWith('error_action_'),
  
  async execute(interaction) {
    try {
      const errorId = interaction.customId.replace('error_action_', '');
      const action = interaction.values[0];

      if (action === 'review') {
        const modal = new ModalBuilder()
          .setCustomId(`review_modal_${errorId}`)
          .setTitle('Review Error');

        const reasonInput = new TextInputBuilder()
          .setCustomId('review_reason')
          .setLabel('Possible reason for this error')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explain what might be causing this error...')
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(1000);

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        
      } else if (action === 'resolved') {
        const modal = new ModalBuilder()
          .setCustomId(`resolved_modal_${errorId}`)
          .setTitle('Mark as Resolved');

        const commitInput = new TextInputBuilder()
          .setCustomId('commit_hash')
          .setLabel('First 7 digits of repo commit hash')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('abc1234')
          .setMinLength(7)
          .setMaxLength(7)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(commitInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
      }
    } catch (error) {
      console.error('Error in error_action menu:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing your action.',
          ephemeral: true
        });
      }
    }
  }
};