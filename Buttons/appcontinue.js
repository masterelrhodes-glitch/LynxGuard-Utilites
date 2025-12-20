const { applicationStates } = require('../Utils/applicationState');
const { MessageFlags } = require('discord.js');

module.exports = {
  customID: 'appcontinue',
  skipSplit: false,
  async execute(interaction, client, args) {
    const userId = args && args[0] ? args[0] : interaction.user.id;
    const state = applicationStates.get(userId);
    
    console.log('[APP_CONTINUE] Button clicked by:', interaction.user.id);
    console.log('[APP_CONTINUE] Target userId from args:', userId);
    console.log('[APP_CONTINUE] Args:', args);
    console.log('[APP_CONTINUE] State found:', !!state);
    
    if (userId !== interaction.user.id) {
      return await interaction.reply({
        content: ' This is not your application.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    if (!state) {
      return await interaction.reply({
        content: ' Application session not found. Please start over.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferUpdate();

    await interaction.message.delete().catch(() => {});

    state.stage = 'question1';
    applicationStates.set(userId, state);

    console.log('[APP_CONTINUE] Asking first question');

    await interaction.user.send('**1.** Have you worked in any past servers as support (Yes or No)?');
  }
};