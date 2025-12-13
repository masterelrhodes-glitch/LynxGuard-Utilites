const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OrderLog } = require('../../Database/schemas');

const HR_ROLE = '1442346970416156812'; //Who can void things
const ORDER_LOG_CHANNEL = '1442016873326575800'; //Where are the logs being sent

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order-void')
    .setDescription('Void an order')
    .addStringOption(option =>
      option.setName('order_id')
        .setDescription('The order ID to void')
        .setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(HR_ROLE)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const orderId = interaction.options.getString('order_id').toUpperCase();

    await interaction.deferReply({ ephemeral: true });

    try {
      const order = await OrderLog.findOne({ orderId });

      if (!order) {
        return interaction.editReply({ content: `Order #${orderId} not found in the database.` });
      }

      const channel = await interaction.client.channels.fetch(ORDER_LOG_CHANNEL);
      const message = await channel.messages.fetch(order.messageId).catch(() => null);

      if (message) {
        const embed = message.embeds[0];
        const voidedEmbed = EmbedBuilder.from(embed)
          .setColor('#808080')
          .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
          .setFooter({ text: `Voided by ${interaction.user.username}` });

        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`voided_${orderId}`)
              .setLabel('Order Voided')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );

        await message.edit({ embeds: [voidedEmbed], components: [disabledRow] });
      }

      await OrderLog.findOneAndDelete({ orderId });

      await interaction.editReply({ content: `Order #${orderId} has been voided and removed from the database.` });

    } catch (error) {
      console.error('Error in order-void command:', error);
      return interaction.editReply({ content: 'An error occurred while voiding the order. Please try again later.' });
    }
  },
};