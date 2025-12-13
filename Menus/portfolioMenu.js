const { EmbedBuilder, time, ChannelType } = require('discord.js');

module.exports = {
  name: 'portfolio',
  description: 'Handles the portfolio category select menu and creates the portfolio thread',
  
  async execute(interaction) {
    const selectedCategories = interaction.values;
    
    const categories = {
      livery: { label: "Livery's", tag: '1443080518827638855', role: '1443081038363492432' },
      graphic: { label: "Graphic's", tag: '1443080559634153542', role: '1443081067622826085' },
      photography: { label: 'Photography', tag: '1443080612163489824', role: '1443080998236590160' },
      clothing: { label: 'Clothing', tag: '1443080588239179836', role: '1443080958390571008' },
    };

    const targetMember = interaction.client.targetMember;
    const forumChannel = interaction.client.forumChannel;
    const targetUser = targetMember.user;
    const creator = interaction.client.creator;

    if (!targetMember || !forumChannel) {
      return interaction.update({ content: 'Something went wrong.', components: [] });
    }

    await interaction.update({ content: `Creating portfolio for ${targetMember.nickname || targetUser.username}...`, components: [] });

    const selectedTags = selectedCategories.map(key => categories[key].tag);

    const thread = await forumChannel.threads.create({
      name: `${targetMember.nickname || targetUser.username}'s portfolio`,
      autoArchiveDuration: 1440,
      message: {
        files: ['https://media.discordapp.net/attachments/1399920144918249553/1443057063038292069/image.webp?ex=6927af1e&is=69265d9e&hm=3243156b28c1f5fe333fff59637473531e649c30bdcf404198c0da9d7fe068f9&=&format=png&width=1152&height=322']
      },
      appliedTags: selectedTags,
      reason: `Portfolio created by ${creator.tag}`,
    });

    await thread.send({ content: `${targetMember} Welcome to your portfolio thread! Please upload your work.` });

    for (const key of selectedCategories) {
      const data = categories[key];
      if (!data) continue;

      if (!targetMember.roles.cache.has(data.role)) {
        await targetMember.roles.add(data.role, 'Portfolio role assignment');
      }
    }

    const deadlineTimestamp = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
    const selectedLabels = selectedCategories.map(key => categories[key].label).join(', ');

    const dmEmbed = new EmbedBuilder()
      .setTitle('<:OrbitLogo2:1443093571761733672> Portfolio Created')
      .setColor('#2f3136')
      .setDescription(`Your portfolio has been created by **${creator.username}**. You are required to upload your work showcasing your skills and creativity within the allocated timeframe. This portfolio will serve as a demonstration of your capabilities and will be reviewed by our team. Ensure that all submissions meet the quality standards expected for the selected categories.`)
      .addFields(
        { name: 'Selected Categories', value: selectedLabels, inline: true },
        { name: 'Time Remaining', value: time(deadlineTimestamp, 'R'), inline: true }
      )
      .setImage('https://media.discordapp.net/attachments/1399920144918249553/1443057063705055276/image-149.png?ex=6927af1e&is=69265d9e&hm=c7b12220d0e68cb2c834115d5408ce5f383bdaf0ca302f84af1857587b0d68fc&=&format=png&quality=lossless&width=1783&height=81')
      .setFooter({ 
        text: 'Failure to complete this task will result in an infraction.', 
        iconURL: 'https://cdn.discordapp.com/icons/1413148426954215476/c063413e701fc62bb1271036a7985e10.webp?size=1024'
      })
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.log(`Could not DM ${targetUser.tag}:`, err);
    }

    await interaction.editReply({ content: `Portfolio for **${targetMember.nickname || targetUser.username}** created: ${thread.url}`, components: [] });
  },
};