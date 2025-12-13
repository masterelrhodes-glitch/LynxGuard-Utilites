const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CustomerStats } = require('../../Database/schemas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customer-panel')
    .setDescription('View your customer statistics'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const stats = await CustomerStats.findOne({ customerId: interaction.user.id });

      if (!stats || stats.totalOrders === 0) {
        return interaction.editReply({ 
          content: 'You haven\'t placed any orders yet!' 
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('Customer Panel')
        .setDescription(`**Welcome, ${interaction.user.username}!**\n\nHere are your order statistics:`)
        .addFields(
          { name: ' Total Orders', value: `${stats.totalOrders}`, inline: true },
          { name: ' Robux Spent', value: `${stats.totalSpent.toFixed(0)} R$`, inline: true },
          { name: ' Orders Reviewed', value: `${stats.ordersReviewed}`, inline: true }
        )
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .setTimestamp();

      // Only show favorite designer if they have 3+ orders
      if (stats.favoriteDesigner && stats.favoriteDesignerCount >= 3) {
        embed.addFields({
          name: ' Favorite Designer',
          value: `<@${stats.favoriteDesigner}> (${stats.favoriteDesignerCount} orders)`,
          inline: false
        });
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`viewcustomerorders_${interaction.user.id}`)
            .setLabel('View My Orders')
            .setStyle(ButtonStyle.Primary)
            
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('Error in customer-panel command:', error);
      return interaction.editReply({ 
        content: 'An error occurred while fetching your customer statistics.' 
      });
    }
  }
};