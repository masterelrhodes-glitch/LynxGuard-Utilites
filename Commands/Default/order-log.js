const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OrderLog, CustomerStats } = require('../../Database/schemas');
//Change with your role ID's and other information.
const DESIGNER_ROLE = '1442347022681116805'; //Who can log orders.
const CUSTOMER_ROLE = '1442560292071674056'; //Role given on order logging.
const DESIGNER_TAKE = 0.85; // The percent that the desinger keeps -> In this case 85%
const ORDER_LOG_CHANNEL = '1442016873326575800'; //Where the log will be sent
const HR_ROLE = '1442346970416156812'; //Who can void, view desinger stats and do payouts.

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order-log')
    .setDescription('Log a new order')
    .addUserOption(option =>
      option.setName('customer')
        .setDescription('Th/e customer who placed the order')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('gamepass_price')
        .setDescription('The gamepass price in Robux')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('order_field')
        .setDescription('Type of order')
        .setRequired(true)
        .addChoices(
          { name: 'Livery', value: 'Livery' },
          { name: 'Clothing', value: 'Clothing' },
          { name: 'Graphics', value: 'Graphics' },
          { name: 'Discord', value: 'Discord' }
        ))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Number of items in this order')
        .setRequired(true)
        .setMinValue(1)),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(DESIGNER_ROLE)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const customer = interaction.options.getUser('customer');
    const gamepassPrice = interaction.options.getNumber('gamepass_price');
    const orderField = interaction.options.getString('order_field');
    const quantity = interaction.options.getInteger('quantity');

    const taxedPrice = gamepassPrice * 0.7;
    const designerTakeAmount = taxedPrice * DESIGNER_TAKE;
    const orderId = generateOrderId();

    let customerMember;
    let roleAdded = false;

    
    try {
      customerMember = await interaction.guild.members.fetch(customer.id);
      
      if (!customerMember.roles.cache.has(CUSTOMER_ROLE)) {
        await customerMember.roles.add(CUSTOMER_ROLE);
        roleAdded = true;
        console.log(`[ORDER-LOG] Added customer role to ${customer.username} (${customer.id})`);
      }
    } catch (error) {
      console.error(`[ORDER-LOG] Error adding customer role to ${customer.username}:`, error);
    }

    const embed = new EmbedBuilder()
      .setColor('#808080')
      .setTitle('Order Log')
      .setDescription('This order has been logged and is awaiting payment confirmation.')
      .addFields(
        { name: 'Designer', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Customer', value: `<@${customer.id}>`, inline: true },
        { name: 'Order Type', value: orderField, inline: true },
        { name: 'Quantity', value: `${quantity}`, inline: true },
        { name: 'Taxed Price', value: `${taxedPrice.toFixed(0)} R$`, inline: true },
        { name: 'Designer Take', value: `${designerTakeAmount.toFixed(0)} R$`, inline: true }
      )
      .setFooter({ text: `Order ID: ${orderId}` })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`paid_${orderId}`)
          .setLabel('Paid')
          .setStyle(ButtonStyle.Success)
      );

    const channel = await interaction.client.channels.fetch(ORDER_LOG_CHANNEL);
    const message = await channel.send({ embeds: [embed], components: [row] });

    await OrderLog.create({
      orderId,
      designer: interaction.user.id,
      designerUsername: interaction.user.username,
      customer: customer.id,
      gamepassPrice,
      taxedPrice,
      orderField,
      quantity,
      designerTake: designerTakeAmount,
      status: 'unpaid',
      messageId: message.id
    });

    await updateCustomerStats(customer.id, gamepassPrice, interaction.user.id, interaction.user.username);


    try {
      const receiptEmbed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('Order Receipt')
        .setDescription('Thank you for your order. Your order has been successfully placed and is being processed.')
        .addFields(
          { name: 'Order ID', value: orderId, inline: true },
          { name: 'Order Type', value: orderField, inline: true },
          { name: 'Quantity', value: `${quantity}`, inline: true },
          { name: 'Total Price', value: `${gamepassPrice.toFixed(0)} R$`, inline: true },
          { name: 'Designer', value: `${interaction.user.username}`, inline: true },
        
        )
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .setFooter({ text: `Order placed on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` })
        .setTimestamp();

      await customer.send({ embeds: [receiptEmbed] });
      console.log(`[ORDER-LOG] Sent receipt to ${customer.username}`);
    } catch (dmError) {
      console.error(`[ORDER-LOG] Could not send receipt to ${customer.username}:`, dmError.message);
    }

    await interaction.reply({ 
      content: `Order #${orderId} has been logged successfully!${roleAdded ? '\nCustomer role has been assigned.' : ''}`, 
      ephemeral: true 
    });
  }
};

function generateOrderId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function updateCustomerStats(customerId, spent, designerId, designerUsername) {
  const { CustomerStats, OrderLog } = require('../../Database/schemas');
  
  let stats = await CustomerStats.findOne({ customerId });

  if (!stats) {
    stats = await CustomerStats.create({
      customerId,
      totalOrders: 1,
      totalSpent: spent,
      ordersReviewed: 0
    });
  } else {
    stats.totalOrders += 1;
    stats.totalSpent += spent;
    stats.updatedAt = new Date();
  }

  const designerCounts = await OrderLog.aggregate([
    { $match: { customer: customerId } },
    { $group: { _id: { designer: '$designer', username: '$designerUsername' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 }
  ]);

  if (designerCounts.length > 0 && designerCounts[0].count >= 3) {
    stats.favoriteDesigner = designerCounts[0]._id.designer;
    stats.favoriteDesignerUsername = designerCounts[0]._id.username;
    stats.favoriteDesignerCount = designerCounts[0].count;
  }

  await stats.save();
}