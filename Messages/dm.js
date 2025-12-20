module.exports = {
  name: 'dm',
  description: 'Delete a specified number of bot DM messages',
  users: ['1446352448037064755'],
  async execute(interaction, client, args) {
    try {
      const amount = parseInt(args[0]);
      
      console.log('[DM DELETE] Command called by:', interaction.author.id);
      console.log('[DM DELETE] Amount to delete:', amount);
      
      if (!amount || isNaN(amount) || amount < 1) {
        return await interaction.reply(' Please provide a valid number of messages to delete.\nUsage: `-dm <number>`');
      }
      
      if (amount > 100) {
        return await interaction.reply(' You can only delete up to 100 messages at a time.');
      }
      
      if (!interaction.channel.isDMBased()) {
        return await interaction.reply(' This command can only be used in DMs!');
      }
      
      await interaction.reply(` Deleting ${amount} bot messages...`);
      
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      
      console.log('[DM DELETE] Total messages fetched:', messages.size);
      
      const botMessages = messages.filter(msg => msg.author.id === client.user.id);
      
      console.log('[DM DELETE] Bot messages found:', botMessages.size);
      
      const messagesToDelete = Array.from(botMessages.values()).slice(0, amount);
      
      console.log('[DM DELETE] Messages to delete:', messagesToDelete.length);
      
      let deleted = 0;
      let failed = 0;
      
      for (const msg of messagesToDelete) {
        try {
          await msg.delete();
          deleted++;
          console.log('[DM DELETE] Deleted message:', msg.id);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          failed++;
          console.error('[DM DELETE] Failed to delete message:', msg.id, error.message);
        }
      }
      
      await interaction.channel.send(` Deletion complete!\n- Deleted: ${deleted} messages\n- Failed: ${failed} messages`);
      
      console.log('[DM DELETE] Complete - Deleted:', deleted, 'Failed:', failed);
      
    } catch (error) {
      console.error('[DM DELETE] Error:', error);
      await interaction.reply(` An error occurred: ${error.message}`).catch(() => {});
    }
  }
};