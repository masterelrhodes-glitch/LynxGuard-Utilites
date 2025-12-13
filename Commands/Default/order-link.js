const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { AccountLink } = require('../../Database/schemas');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order-link')
    .setDescription('Link your Roblox account')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your Roblox username')
        .setRequired(true)),

  async execute(interaction) {
    const username = interaction.options.getString('username');

    await interaction.deferReply({ ephemeral: true });

    try {
      const existingLink = await AccountLink.findOne({ discordId: interaction.user.id });
      if (existingLink) {
        const changeEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('Account Already Linked')
          .setDescription(`You currently have **${existingLink.robloxUsername}** linked to your account.\n\nWould you like to change your linked account?`);

        const changeRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`change_link_${interaction.user.id}`)
              .setLabel('Change Account')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`keep_link_${interaction.user.id}`)
              .setLabel('Keep Current')
              .setStyle(ButtonStyle.Secondary)
          );

        await interaction.editReply({ embeds: [changeEmbed], components: [changeRow] });
        
        return;
      }

      const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
        usernames: [username],
        excludeBannedUsers: false
      });

      if (!response.data.data || response.data.data.length === 0) {
        return interaction.editReply({ content: 'Roblox account not found. Please check the username and try again.' });
      }

      const userData = response.data.data[0];

      const duplicateLink = await AccountLink.findOne({ robloxId: userData.id });
      if (duplicateLink) {
        return interaction.editReply({ content: 'This Roblox account is already linked to another Discord account.' });
      }

      const avatarResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userData.id}&size=420x420&format=Png&isCircular=false`);
      const avatarUrl = avatarResponse.data.data[0].imageUrl;

      const userDetailResponse = await axios.get(`https://users.roblox.com/v1/users/${userData.id}`);
      const accountCreated = new Date(userDetailResponse.data.created);

      const embed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('Confirm Roblox Account')
        .setDescription('Is this your account?')
        .setThumbnail(avatarUrl)
        .setImage('https://cdn.discordapp.com/attachments/1284716939280781435/1442411565780439102/image.png?ex=692555f3&is=69240473&hm=b43939e7b4b5fe30eb32727703917d312dedf29c578271a22e3fc014ddf13b3f')
        .addFields(
          { name: 'Account Name', value: `[${userData.name}](https://www.roblox.com/users/${userData.id}/profile)`, inline: true },
          { name: 'Account ID', value: `${userData.id}`, inline: true },
          { name: 'Join Date', value: accountCreated.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), inline: false }
        );

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_${interaction.user.id}_${userData.id}_${userData.name}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`cancel_${interaction.user.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
      
    } catch (error) {
      console.error('Error in order-link command:', error);
      return interaction.editReply({ content: 'An error occurred while looking up the Roblox account. Please try again later.' });
    }
  },
};