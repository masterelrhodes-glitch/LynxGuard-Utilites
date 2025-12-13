const { AccountLink } = require('../Database/schemas');

module.exports = {
  customID: 'change',
  async execute(interaction, client, args) {
    // args will be ['link', 'userId']
    const userId = args[1];
    
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'This button is not for you.', ephemeral: true });
    }

    try {
      const result = await AccountLink.findOneAndDelete({ discordId: interaction.user.id });
      
      if (result) {
        console.log(`[CHANGE_LINK] Deleted account link for ${interaction.user.id} (was linked to ${result.robloxUsername})`);
      }

      await interaction.update({ 
        content: '✅ Previous link removed. Please run `/order-link` again to link a new account.', 
        embeds: [], 
        components: [] 
      });
    } catch (error) {
      console.error('[CHANGE_LINK] Error removing account link:', error);
      await interaction.update({ 
        content: '❌ An error occurred while removing your account link. Please try again.', 
        embeds: [], 
        components: [] 
      });
    }
  }
};