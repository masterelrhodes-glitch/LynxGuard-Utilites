module.exports = {
  customID: 'crcancel',
  skipSplit: false,
  
  async execute(interaction, client, args) {
    const ticketId = args[0];
    const userId = args[1];

    if (interaction.user.id !== userId) {
      await interaction.deferReply({ flags: 64 }).catch(() => {});
      return await interaction.editReply({
        content: 'Only the ticket owner can cancel the close request.'
      }).catch(() => {});
    }

    try {
      await interaction.message.delete();
    } catch (error) {
      console.error('Error deleting message:', error);
    }

    const channel = await client.channels.fetch(interaction.channelId);
    if (channel) {
      await channel.send({
        content: `<@${userId}> has cancelled the close request.`
      });
    }
  }
};