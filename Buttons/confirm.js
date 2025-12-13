const { EmbedBuilder } = require('discord.js');
const { AccountLink } = require('../Database/schemas');

module.exports = {
  customID: 'confirm',
  async execute(interaction, client, args) {
    // args will be ['userId', 'robloxId', 'robloxUsername']
    const [userId, robloxId, ...nameParts] = args;
    const robloxUsername = nameParts.join('_'); // In case username has underscores
    
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'This button is not for you.', ephemeral: true });
    }

    try {
      // Get account creation date from embed or fetch again
      const userDetailResponse = await require('axios').get(`https://users.roblox.com/v1/users/${robloxId}`);
      const accountCreated = new Date(userDetailResponse.data.created);

      await AccountLink.create({
        discordId: interaction.user.id,
        robloxId: parseInt(robloxId),
        robloxUsername: robloxUsername,
        accountCreated
      });

      const embed = interaction.message.embeds[0];
      const successEmbed = EmbedBuilder.from(embed)
        .setColor('#808080')
        .setTitle('✅ Account Linked Successfully')
       .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .setDescription(`Your Discord account has been linked to **${robloxUsername}**!`);

      await interaction.update({ embeds: [successEmbed], components: [] });
    } catch (error) {
      console.error('Error confirming account link:', error);
      await interaction.update({ 
        content: 'An error occurred while linking your account. Please try again.', 
        embeds: [], 
        components: [] 
      });
    }
  }
};