const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customID: 'error',
  
  async execute(interaction, client, args) {
    try {
      console.log('[MENU DEBUG] Execute called');
      console.log('[MENU DEBUG] Args:', args);
      console.log('[MENU DEBUG] Values:', interaction.values);
      
      const action = interaction.values[0];
      const errorId = args[1];
      
      console.log('[MENU DEBUG] Action:', action);
      console.log('[MENU DEBUG] Error ID:', errorId);

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
        console.log('[MENU DEBUG] Review modal shown');
        
      } else if (action === 'resolved') {
        const modal = new ModalBuilder()
          .setCustomId(`resolved_modal_${errorId}`)
          .setTitle('Mark as Resolved');

        const commitInput = new TextInputBuilder()
          .setCustomId('commit_hash')
          .setLabel('First 7 digits of repo commit hash')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('abc1234')
          .setMinLength(4)
          .setMaxLength(7)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(commitInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        console.log('[MENU DEBUG] Resolved modal shown');
      }
    } catch (error) {
      console.error('Error in error_action menu:', error);
      console.error('Stack:', error.stack);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing your action.',
          ephemeral: true
        });
      }
    }
  }
};