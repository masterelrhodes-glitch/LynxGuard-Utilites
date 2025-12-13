const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { OrderLog, CustomerStats } = require('../../Database/schemas');

const REVIEW_CHANNEL_ID = '1442016873326575800'; // Change this to your review channel

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Review one of your completed orders')
    .addStringOption(option =>
      option.setName('order')
        .setDescription('Select the order to review')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('rating')
        .setDescription('Rate the order (1-5 stars)')
        .setRequired(true)
        .addChoices(
          { name: ' 1 Star', value: 1 },
          { name: ' 2 Stars', value: 2 },
          { name: ' 3 Stars', value: 3 },
          { name: ' 4 Stars', value: 4 },
          { name: ' 5 Stars', value: 5 }
        ))
    .addStringOption(option =>
      option.setName('notes')
        .setDescription('Additional notes or feedback')
        .setRequired(false)
        .setMaxLength(500)),

  async autocomplete(interaction) {
    try {
      const orders = await OrderLog.find({ 
        customer: interaction.user.id,
        reviewed: false 
      }).sort({ createdAt: -1 }).limit(25);

      const choices = orders.map(order => ({
        name: `${order.quantity}x ${order.orderField} - Made by ${order.designerUsername} (Order #${order.orderId})`,
        value: order.orderId
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const orderId = interaction.options.getString('order');
      const rating = interaction.options.getInteger('rating');
      const notes = interaction.options.getString('notes') || 'No additional notes provided.';

      const order = await OrderLog.findOne({ orderId });

      if (!order) {
        return interaction.editReply({ 
          content: 'Order not found.' 
        });
      }

      if (order.customer !== interaction.user.id) {
        return interaction.editReply({ 
          content: 'You can only review your own orders.' 
        });
      }

      if (order.reviewed) {
        return interaction.editReply({ 
          content: 'You have already reviewed this order.' 
        });
      }

      // Update the order with review
      order.reviewed = true;
      order.rating = rating;
      order.reviewNotes = notes;
      await order.save();

      // Update customer stats
      const stats = await CustomerStats.findOne({ customerId: interaction.user.id });
      if (stats) {
        stats.ordersReviewed += 1;
        await stats.save();
      }

      // Send review to review channel
      const reviewChannel = await interaction.client.channels.fetch(REVIEW_CHANNEL_ID);
      
      const stars = '⭐'.repeat(rating);
      const reviewEmbed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle(' New Order Review')
        .setDescription(`**Customer:** <@${interaction.user.id}>\n**Designer:** <@${order.designer}>`)
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .addFields(
          { name: 'Order Details', value: `${order.quantity}x ${order.orderField}`, inline: true },
          { name: 'Rating', value: stars, inline: true },
          { name: 'Order ID', value: orderId, inline: true },
          { name: 'Review Notes', value: notes, inline: false }
        )
        .setTimestamp();

      await reviewChannel.send({ embeds: [reviewEmbed] });

      // Confirm to user
      await interaction.editReply({ 
        content: `✅ Thank you for your review! You rated this order **${rating}/5 stars**.` 
      });

    } catch (error) {
      console.error('Error in review command:', error);
      return interaction.editReply({ 
        content: 'An error occurred while submitting your review.' 
      });
    }
  }
};