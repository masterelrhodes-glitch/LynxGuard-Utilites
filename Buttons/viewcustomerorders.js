const { EmbedBuilder } = require('discord.js');
const { OrderLog } = require('../Database/schemas');

module.exports = {
  customID: 'viewcustomerorders',
  async execute(interaction, client, args) {
    const customerId = args[0];

    if (interaction.user.id !== customerId) {
      return interaction.reply({ 
        content: 'You can only view your own orders.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const orders = await OrderLog.find({ customer: customerId }).sort({ createdAt: -1 });

      if (orders.length === 0) {
        return interaction.editReply({ 
          content: 'You have no orders yet.' 
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('Your Orders')
        .setDescription(`You have **${orders.length}** total order${orders.length !== 1 ? 's' : ''}.`)
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .setTimestamp();

      const displayOrders = orders.slice(0, 15);
      
      const orderList = displayOrders.map((order, index) => {
        const reviewStatus = order.reviewed 
          ? `Reviewed (${order.rating} stars)` 
          : 'Not Reviewed';
        const date = new Date(order.createdAt).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        return `**Order #${order.orderId}**\n` +
               `${order.quantity}x ${order.orderField} | Price: **${order.gamepassPrice.toFixed(0)} R$**\n` +
               `Designer: <@${order.designer}> | ${reviewStatus} | ${date}`;
      }).join('\n\n');

      embed.addFields({ 
        name: 'Recent Orders', 
        value: orderList || 'None' 
      });

      if (orders.length > 15) {
        embed.setFooter({ text: `Showing 15 of ${orders.length} orders` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[VIEWCUSTOMERORDERS] Error:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching your orders.' 
      });
    }
  }
};