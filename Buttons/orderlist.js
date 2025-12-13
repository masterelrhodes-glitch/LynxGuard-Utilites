const { EmbedBuilder } = require('discord.js');
const { OrderLog } = require('../Database/schemas');

module.exports = {
  customID: 'orderlist',
  async execute(interaction, client, args) {
    const targetUserId = args[0];
    
    const HR_ROLE = '1442346970416156812';
    if (interaction.user.id !== targetUserId && !interaction.member.roles.cache.has(HR_ROLE)) {
      return interaction.reply({ 
        content: 'You do not have permission to view this order list.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const unpaidOrders = await OrderLog.find({ 
        designer: targetUserId, 
        status: 'unpaid' 
      }).sort({ createdAt: -1 });

      if (unpaidOrders.length === 0) {
        return interaction.editReply({ 
          content: 'No unpaid orders found.' 
        });
      }

      const totalPending = unpaidOrders.reduce((sum, order) => sum + order.designerTake, 0);

      const chunkSize = 10;
      const chunks = [];
      for (let i = 0; i < unpaidOrders.length; i += chunkSize) {
        chunks.push(unpaidOrders.slice(i, i + chunkSize));
      }

      const createEmbed = (orders, page, totalPages) => {
        const embed = new EmbedBuilder()
          .setColor('#808080')
          .setTitle('Unpaid Orders')
          .setDescription(`**Total Unpaid Orders:** ${unpaidOrders.length}\n**Total Pending Payout:** ${totalPending.toFixed(0)} R$`)
          .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
          .setFooter({ text: `Page ${page}/${totalPages}` })
          .setTimestamp();

        const orderList = orders.map((order, index) => {
          const orderNum = (page - 1) * chunkSize + index + 1;
          const date = new Date(order.createdAt).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          });
          
          return `**Order #${order.orderId}**\n` +
                 `Amount: **${order.designerTake.toFixed(0)} R$** | Type: ${order.orderField}\n` +
                 `Customer: <@${order.customer}> | Date: ${date}`;
        }).join('\n\n');

        embed.addFields({ name: 'Orders', value: orderList || 'None' });

        return embed;
      };

      const embed = createEmbed(chunks[0], 1, chunks.length);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[ORDERLIST] Error fetching unpaid orders:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching your order list. Please try again.' 
      });
    }
  }
};