const { EmbedBuilder } = require('discord.js');
const UserModel = require('../../Database/UserModel');
const axios = require('axios');

const logChannelId = '1449961040010940426';
const targetGuildId = '1446351663622389770';
const verifiedRoleId = '1448097434768248924';
const removeRoleId = '1452932765065678880';

module.exports = {
  defer: true,
  customID: 'verifyDone:button',
  async execute(interaction, args) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const linked = await UserModel.findOne({ duid: interaction.user.id });
    if (!linked) {
      return await interaction.followUp({ content: 'No linked account found. Please press the "Verify" button to link your account.', ephemeral: true });
    }

    const robloxId = linked.ruid;
    const robloxProfile = `https://www.roblox.com/users/${robloxId}/profile`;

    let robloxData;
    try {
      const res = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`);
      robloxData = res.data;
    } catch (err) {
      console.error('Failed to fetch Roblox data:', err);
      return await interaction.followUp({ content: 'Failed to fetch Roblox account information. Please try again later.', ephemeral: true });
    }

    const robloxUsername = robloxData.name;
    const robloxCreatedTimestamp = robloxData.created
      ? Math.floor(new Date(robloxData.created).getTime() / 1000)
      : null;

    let robloxAvatar = '';
    try {
      const thumbRes = await axios.get(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png`
      );
      robloxAvatar = thumbRes.data.data[0].imageUrl || '';
    } catch (err) {
      console.error('Failed to fetch Roblox avatar:', err);
      robloxAvatar = '';
    }

    const embed = new EmbedBuilder()
      .setTitle('Verification Log')
      .setColor(2829618)
      .setAuthor({ name: interaction.user.tag, url: `https://discord.com/users/${interaction.user.id}`, iconURL: interaction.user.displayAvatarURL() })
      .setThumbnail(robloxAvatar)
      .addFields(
        {
          name: 'Roblox Account Information',
          value: `> Username: [${robloxUsername}](${robloxProfile}) (${robloxId})${robloxCreatedTimestamp ? `\n> Account Creation Date: <t:${robloxCreatedTimestamp}:F>` : ''}`
        },
        {
          name: 'Discord Account Information',
          value: `> Username: [${interaction.user.tag}](https://discord.com/users/${interaction.user.id}) (${interaction.user.id})\n> Account Creation Date: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:F>`
        }
      )
      .setFooter({ 
        text: `Guild ID: ${interaction.guild.id}`, 
        iconURL: interaction.guild.iconURL() 
      })
      .setTimestamp();

    const logChannel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (logChannel) {
      await logChannel.send({ embeds: [embed] });
    }

    if (interaction.guild.id === targetGuildId) {
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (member) {
        await member.roles.add(verifiedRoleId).catch(err => console.error('Failed to add verified role:', err));
        await member.roles.remove(removeRoleId).catch(err => console.error('Failed to remove role:', err));
      }
    }

    await interaction.followUp({
      content: `You have been verified!\n-# Your account is linked to [**${robloxUsername}**](${robloxProfile})`,
      ephemeral: true
    });
  }
};