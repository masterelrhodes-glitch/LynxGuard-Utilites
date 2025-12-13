const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OrderLog, AccountLink } = require('../../Database/schemas');
const axios = require('axios');

const HR_ROLE = '1442346970416156812';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orders-view')
    .setDescription('View a designers order statistics')
    .addUserOption(option =>
      option.setName('designer')
        .setDescription('The designer to view stats for')
        .setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('designer') || interaction.user;
    
    
    if (targetUser.id !== interaction.user.id) {
      if (!interaction.member.roles.cache.has(HR_ROLE)) {
        return interaction.reply({ 
          content: 'You do not have permission to view other designers\' statistics.', 
          ephemeral: true 
        });
      }
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const accountLink = await AccountLink.findOne({ discordId: targetUser.id });

      if (!accountLink) {
        return interaction.editReply({ 
          content: `${targetUser.id === interaction.user.id ? 'You have' : 'This designer has'} not linked ${targetUser.id === interaction.user.id ? 'your' : 'their'} Roblox account.` 
        });
      }

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const allOrders = await OrderLog.find({ designer: targetUser.id });
      const weeklyOrders = allOrders.filter(order => order.createdAt >= oneWeekAgo);
      const biWeeklyOrders = allOrders.filter(order => order.createdAt >= twoWeeksAgo);
      const unpaidOrders = allOrders.filter(order => order.status === 'unpaid');

      const totalIncome = allOrders.reduce((sum, order) => sum + order.designerTake, 0);
      const unpaidIncome = unpaidOrders.reduce((sum, order) => sum + order.designerTake, 0);

      const avatarResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${accountLink.robloxId}&size=420x420&format=Png&isCircular=false`);
      const avatarUrl = avatarResponse.data.data[0].imageUrl;

      const embed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle(` Order Statistics: ${targetUser.username}`)
        .setDescription(
          `**Roblox Account:** [${accountLink.robloxUsername}](https://www.roblox.com/users/${accountLink.robloxId}/profile)\n` +
          `**Roblox ID:** ${accountLink.robloxId}\n` +
          `**Account Created:** ${accountLink.accountCreated.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
        )
        .setThumbnail(avatarUrl)
        .addFields(
          { name: ' Weekly Orders', value: `${weeklyOrders.length}`, inline: true },
          { name: ' Bi-Weekly Orders', value: `${biWeeklyOrders.length}`, inline: true },
          { name: ' Total Orders', value: `${allOrders.length}`, inline: true },
          { name: ' Total Income', value: `${totalIncome.toFixed(0)} R$`, inline: true },
          { name: ' Unpaid Orders', value: `${unpaidOrders.length}`, inline: true },
          { name: ' Pending Payout', value: `${unpaidIncome.toFixed(0)} R$`, inline: true }
        )
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`orderlist_${targetUser.id}`)
            .setLabel('View Order List')
            .setStyle(ButtonStyle.Primary)
           .setDisabled(unpaidOrders.length === 0)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('Error in orders-view command:', error);
      return interaction.editReply({ 
        content: 'An error occurred while fetching order statistics. Please try again later.' 
      });
    }
  },
};