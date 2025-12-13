module.exports = {
  customID: 'embed',
  async execute(interaction, client, args) {
    const channelId = args[1];
    
    const embedContent = interaction.fields.getTextInputValue('embed_content');

    let targetChannel;
    if (channelId === 'current') {
      targetChannel = interaction.channel;
    } else {
      targetChannel = await interaction.guild.channels.fetch(channelId);
    }

    if (!targetChannel) {
      return await interaction.reply({
        content: 'Target channel not found.',
        flags: 64
      });
    }

    try {
      const messageData = JSON.parse(embedContent);
      
      const payload = {};
      
      if (messageData.content) {
        payload.content = messageData.content;
      }
      
      if (messageData.embeds) {
        payload.embeds = messageData.embeds;
      } else if (messageData.author || messageData.description || messageData.fields || messageData.image || messageData.thumbnail || messageData.title || messageData.color) {
        payload.embeds = [messageData];
      }
      
      if (messageData.components) {
        payload.components = messageData.components.map(actionRow => {
          return {
            ...actionRow,
            components: actionRow.components.map(component => {
              const cleanComponent = { ...component };
              
              if (cleanComponent.style === 5 && cleanComponent.url) {
                delete cleanComponent.custom_id;
              } else if (cleanComponent.custom_id) {
                delete cleanComponent.url;
              }
              
              return cleanComponent;
            })
          };
        });
      }
      
      await targetChannel.send(payload);

      await interaction.reply({
        content: `Embed sent to ${targetChannel}!`,
        flags: 64
      });

    } catch (error) {
      console.error('[EMBED] Error:', error);
      await interaction.reply({
        content: `Failed to send embed: ${error.message}`,
        flags: 64
      });
    }
  }
};