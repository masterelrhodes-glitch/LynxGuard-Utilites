const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OrderLog, AccountLink } = require('../Database/schemas');
const axios = require('axios');

const HR_ROLE = '1442346970416156812';
const ORDER_LOG_CHANNEL = '1442016873326575800';
const GROUP_ID = '11170486';

module.exports = {
  customID: 'process_payouts',
  async execute(interaction, client, args) {
    // Permission check
    if (!interaction.member.roles.cache.has(HR_ROLE)) {
      return interaction.reply({ 
        content: 'You do not have permission to process payouts.', 
        ephemeral: true 
      });
    }

    await interaction.deferUpdate();

    try {
      // Fetch all unpaid orders
      const unpaidOrders = await OrderLog.find({ status: 'unpaid' });
      
      if (unpaidOrders.length === 0) {
        return interaction.followUp({
          content: 'No unpaid orders found.',
          ephemeral: true
        });
      }
      
      // Group orders by designer
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

      // Check eligibility (2 weeks in group)
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const eligible = [];

      for (const [discordId, data] of Object.entries(designerPayouts)) {
        const accountLink = await AccountLink.findOne({ discordId });

        if (!accountLink) {
          console.log(`[PAYOUTS] No account link found for ${discordId}`);
          continue;
        }

        try {
          // Check if member is in the group using the correct endpoint
          const groupRolesResponse = await axios.get(
            `https://groups.roblox.com/v1/users/${accountLink.robloxId}/groups/roles`
          );
          
          // Find if user is in the specific group
          const groupMembership = groupRolesResponse.data.data.find(
            g => g.group.id === parseInt(GROUP_ID)
          );

          if (!groupMembership) {
            console.log(`[PAYOUTS] ${accountLink.robloxUsername} (${accountLink.robloxId}) is not in group ${GROUP_ID}`);
            continue;
          }

          // Get group member info to check join date
          // Use the v2 endpoint for getting user's group membership details
          const memberInfoResponse = await axios.get(
            `https://groups.roblox.com/v2/users/${accountLink.robloxId}/groups/roles`
          );
          
          const groupInfo = memberInfoResponse.data.data.find(
            g => g.group.id === parseInt(GROUP_ID)
          );

          if (!groupInfo) {
            console.log(`[PAYOUTS] Could not find group info for ${accountLink.robloxUsername}`);
            continue;
          }

          console.log(`[PAYOUTS] ${accountLink.robloxUsername} is in the group with role: ${groupInfo.role.name}`);

          eligible.push({
            discordId,
            username: data.username,
            robloxUsername: accountLink.robloxUsername,
            robloxId: accountLink.robloxId,
            amount: data.amount,
            orders: data.orders,
            role: groupInfo.role.name
          });
          
          console.log(`[PAYOUTS] ${accountLink.robloxUsername} is eligible (${data.orders.length} orders, ${data.amount} R$)`);

        } catch (error) {
          console.error(
            `[PAYOUTS] Error checking group membership for ${accountLink.robloxUsername} (${accountLink.robloxId}):`, 
            error.response?.status,
            error.response?.data || error.message
          );
        }
      }

      if (eligible.length === 0) {
        const embed = interaction.message.embeds[0];
        const failEmbed = EmbedBuilder.from(embed)
          .setColor('#808080')
          .setTitle('No Eligible Designers')
          .setDescription('No eligible designers found. Designers must:\n• Have a linked Roblox account\n• Be a member of the group');

        await interaction.message.edit({ embeds: [failEmbed], components: [] });
        return;
      }

      // Update all eligible orders to paid status
      const channel = await client.channels.fetch(ORDER_LOG_CHANNEL);
      let processedCount = 0;

      console.log(`[PAYOUTS] Processing ${eligible.length} eligible designers...`);

      for (const designer of eligible) {
        // Send DM to designer
        try {
          const designerUser = await client.users.fetch(designer.discordId);
          
          const dmEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setTitle('Payout Processed')
            .setDescription(`Your payout has been processed by ${interaction.user.username}`)
            .addFields(
              { name: 'Total Amount', value: `${designer.amount.toFixed(0)} R$`, inline: true },
              { name: 'Orders Completed', value: `${designer.orders.length}`, inline: true },
              { name: 'Roblox Account', value: `[${designer.robloxUsername}](https://www.roblox.com/users/${designer.robloxId}/profile)`, inline: false }
            )
            .setFooter({ text: `Processed by ${interaction.user.username}` })
            .setTimestamp();

          // Add order breakdown if there are multiple orders
          if (designer.orders.length > 1) {
            const orderBreakdown = designer.orders.map((order, index) => 
              `Order ${index + 1}: ${order.orderField} - ${order.designerTake.toFixed(0)} R$`
            ).join('\n');
            
            if (orderBreakdown.length <= 1024) {
              dmEmbed.addFields({ name: 'Order Breakdown', value: orderBreakdown, inline: false });
            }
          }

          await designerUser.send({ embeds: [dmEmbed] });
          console.log(`[PAYOUTS] Sent DM to ${designer.username}`);
        } catch (dmError) {
          console.error(`[PAYOUTS] Could not send DM to ${designer.username}:`, dmError.message);
        }

        // Process all orders for this designer
        for (const order of designer.orders) {
          try {
            const message = await channel.messages.fetch(order.messageId).catch(() => null);

            if (message) {
              const embed = message.embeds[0];
              const paidEmbed = EmbedBuilder.from(embed)
                .setColor('#808080')
                .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
                .setFooter({ 
                  text: `Paid by ${interaction.user.username} | Order ID: ${order.orderId}` 
                });

              const disabledRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`paid_${order.orderId}`)
                    .setLabel('Order Paid')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
                );

              await message.edit({ embeds: [paidEmbed], components: [disabledRow] });
            }

            // Update order status in database
            await OrderLog.findOneAndUpdate(
              { orderId: order.orderId },
              { status: 'paid' }
            );
            
            processedCount++;
            console.log(`[PAYOUTS] Processed order ${order.orderId}`);
          } catch (error) {
            console.error(`[PAYOUTS] Error processing order ${order.orderId}:`, error);
          }
        }
      }

      // Update the payouts message
      const embed = interaction.message.embeds[0];
      const successEmbed = EmbedBuilder.from(embed)
        .setColor('#808080')
        .setTitle('Payouts Processed')
        .setDescription(
          `Successfully processed **${processedCount}** order${processedCount !== 1 ? 's' : ''} ` +
          `for **${eligible.length}** designer${eligible.length !== 1 ? 's' : ''}.`
        )
        .setFooter({ text: `Processed by ${interaction.user.username}` })
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .setTimestamp();

      await interaction.message.edit({ embeds: [successEmbed], components: [] });
      
      console.log(`[PAYOUTS] Successfully processed ${processedCount} orders for ${eligible.length} designers`);

    } catch (error) {
      console.error('[PAYOUTS] Fatal error processing payouts:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('Error Processing Payouts')
        .setDescription(`An error occurred: ${error.message}\n\nPlease check the logs for more details.`)
        .setTimestamp();

      await interaction.message.edit({ embeds: [errorEmbed], components: [] }).catch(() => {});
      
      await interaction.followUp({ 
        content: `Error: ${error.message}`, 
        ephemeral: true 
      }).catch(() => {});
    }
  }
};