const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OrderLog, AccountLink } = require('../../Database/schemas');
const axios = require('axios');

const HR_ROLE = '1442346970416156812'; //Who can use this command
const GROUP_ID = '11170486'; //What group does it check (To see if the user has been in it for 2 weeks or not)

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payouts')
    .setDescription('View and process payouts for designers'),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(HR_ROLE)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const unpaidOrders = await OrderLog.find({ status: 'unpaid' });

      const designerPayouts = {};

      for (const order of unpaidOrders) {
        if (!designerPayouts[order.designer]) {
          designerPayouts[order.designer] = {
            username: order.designerUsername,
            amount: 0,
            orders: []
          };
        }
        designerPayouts[order.designer].amount += order.designerTake;
        designerPayouts[order.designer].orders.push(order);
      }

      const eligible = [];
      const ineligible = [];

      for (const [discordId, data] of Object.entries(designerPayouts)) {
        const accountLink = await AccountLink.findOne({ discordId });

        if (!accountLink) {
          ineligible.push({
            discordId,
            username: data.username,
            amount: data.amount,
            reason: 'No linked Roblox account',
            orders: data.orders
          });
          continue;
        }

        try {
          const userRolesResponse = await axios.get(`https://groups.roblox.com/v2/users/${accountLink.robloxId}/groups/roles`);
          const groupMembership = userRolesResponse.data.data.find(g => g.group.id === parseInt(GROUP_ID));

          if (!groupMembership) {
            ineligible.push({
              discordId,
              username: data.username,
              robloxUsername: accountLink.robloxUsername,
              robloxId: accountLink.robloxId,
              amount: data.amount,
              reason: 'Not in group',
              orders: data.orders
            });
            continue;
          }

          eligible.push({
            discordId,
            username: data.username,
            robloxUsername: accountLink.robloxUsername,
            robloxId: accountLink.robloxId,
            amount: data.amount,
            orders: data.orders
          });

        } catch (error) {
          console.error(`Error checking group membership for ${accountLink.robloxUsername}:`, error.message);
          ineligible.push({
            discordId,
            username: data.username,
            robloxUsername: accountLink.robloxUsername,
            robloxId: accountLink.robloxId,
            amount: data.amount,
            reason: 'Error checking group membership',
            orders: data.orders
          });
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('Designer Payouts')
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .setTimestamp();

      if (eligible.length > 0) {
        const eligibleText = eligible.map(d => 
          `<@${d.discordId}> - [${d.robloxUsername}](https://www.roblox.com/users/${d.robloxId}/profile) - **${d.amount.toFixed(0)} R$**`
        ).join('\n');
        embed.addFields({ name: 'Eligible for Payout', value: eligibleText || 'None' });
      }

      if (ineligible.length > 0) {
        const ineligibleText = ineligible.map(d => {
          const robloxLink = d.robloxUsername ? `[${d.robloxUsername}](https://www.roblox.com/users/${d.robloxId}/profile)` : 'No account';
          return `<@${d.discordId}> - ${robloxLink} - **${d.amount.toFixed(0)} R$** - ${d.reason}`;
        }).join('\n');
        embed.addFields({ name: 'Not Eligible Yet', value: ineligibleText || 'None' });
      }

      if (eligible.length === 0 && ineligible.length === 0) {
        embed.setDescription('No pending payouts found.');
        return interaction.editReply({ embeds: [embed] });
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('process_payouts')
            .setLabel(`Process ${eligible.length} Payout${eligible.length !== 1 ? 's' : ''}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(eligible.length === 0)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('Error in payouts command:', error);
      return interaction.editReply({ content: 'An error occurred while processing payouts. Please try again later.' });
    }
  },
};