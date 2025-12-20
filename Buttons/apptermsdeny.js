const { applicationStates } = require('../Utils/applicationState');
const { MessageFlags } = require('discord.js');

module.exports = {
  customID: 'apptermsdeny',  
  skipSplit: false,
  async execute(interaction, client, args) {
    const userId = args && args[0] ? args[0] : interaction.user.id;
    
    console.log('[APP_TERMS_DENY] Button clicked by:', interaction.user.id);
    console.log('[APP_TERMS_DENY] Target userId from args:', userId);
    
    if (userId !== interaction.user.id) {
      return await interaction.reply({
        content: 'This is not your application.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    applicationStates.delete(userId);
    
    await interaction.message.delete().catch(() => {});
    
    const cancelingMsg = await interaction.user.send('<a:Materialloading:1448102835148296202>  **Canceling** application.');
    
    setTimeout(async () => {
      await cancelingMsg.edit('<:trash:1451073117211332628> Application **canceled**').catch(() => {});
    }, 3000);
    
    console.log('[APP_TERMS_DENY] Application cancelled');
  }
};