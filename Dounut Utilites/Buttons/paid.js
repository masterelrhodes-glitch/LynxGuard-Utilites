const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OrderLog } = require('../Database/schemas');

const HR_ROLE = '1442346970416156812';

module.exports = {
  customID: 'paid',
  async execute(interaction, client) {
    console.log('[PAID BUTTON] Button clicked!');
    console.log('[PAID BUTTON] customId:', interaction.customId);
    console.log('[PAID BUTTON] User:', interaction.user.tag);
    
    const orderId = interaction.customId.replace('paid_', '');
    console.log('[PAID BUTTON] Extracted Order ID:', orderId);

    if (!interaction.member.roles.cache.has(HR_ROLE)) {
      console.log('[PAID BUTTON] User does not have HR role');
      return interaction.reply({ content: 'You do not have permission to mark this as paid.', ephemeral: true });
    }

    const order = await OrderLog.findOne({ orderId });
    console.log('[PAID BUTTON] Found order:', order ? 'Yes' : 'No');
    
    if (!order) {
      return interaction.reply({ content: 'Order not found.', ephemeral: true });
    }

    const embed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(embed)
      .setColor('#808080')
      .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
      .setFooter({ text: `Paid by ${interaction.user.username} | Order ID: ${orderId}` });

    const disabledRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`paid_${orderId}`)
          .setLabel('Paid')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

    await interaction.message.edit({ embeds: [updatedEmbed], components: [disabledRow] });
    await OrderLog.findOneAndUpdate({ orderId }, { status: 'paid' });
    console.log('[PAID BUTTON] Order marked as paid successfully');
    await interaction.reply({ content: `Order #${orderId} has been marked as paid.`, ephemeral: true });
  }
};