module.exports = {
  customID: 'cancel',
  async execute(interaction, client, args) {
    // args will be ['userId']
    const userId = args[0];
    
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'This button is not for you.', ephemeral: true });
    }

    await interaction.update({ 
      content: 'Account linking cancelled.', 
      embeds: [], 
      components: [] 
    });
  }
};