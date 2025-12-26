const { MessageFlags } = require('discord.js');

module.exports = {
  customID: 'embed',
  async execute(interaction, client, args) {
    if (args.length === 0 || args[0] !== 'send') {
      return;
    }

    const channelId = args[1];
    const targetChannel = channelId === 'current' 
      ? interaction.channel 
      : await interaction.guild.channels.fetch(channelId);

    if (!targetChannel) {
      return await interaction.reply({
        content: 'Could not find the target channel.',
        flags: MessageFlags.Ephemeral
      });
    }

    const jsonContent = interaction.fields.getTextInputValue('embed_content');
    
    try {
      const messageData = JSON.parse(jsonContent);
      
      fixLinkButtons(messageData);
      
      const isV2 = messageData.components?.some(comp => 
        comp.type === 17 ||
        comp.type === 18 ||
        comp.type === 19 ||
        comp.type === 20 ||
        comp.type === 21 ||
        comp.type === 22
      );

      if (isV2) {
        messageData.flags = (messageData.flags || 0) | MessageFlags.IsComponentsV2;
      }

      await targetChannel.send(messageData);
      
      await interaction.reply({
        content: `Successfully sent ${isV2 ? 'display components' : 'embed'} message to ${targetChannel}!`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error sending embed:', error);
      
      let errorMsg = error.message;
      if (error.rawError?.errors) {
        const errors = flattenErrors(error.rawError.errors);
        errorMsg = 'Validation errors:\n' + errors.map(e => `• ${e}`).join('\n');
      }
      
      await interaction.reply({
        content: `Failed to send message:\n\`\`\`${errorMsg}\`\`\``,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

function fixLinkButtons(data) {
  if (!data.components) return;
  
  for (const component of data.components) {
    if (component.components) {
      for (const child of component.components) {
        if (child.accessory) {
          if (child.accessory.url && child.accessory.custom_id) {
            delete child.accessory.custom_id;
          }
          if (child.accessory.media && !child.accessory.media.url) {
            child.accessory.media.url = 'https://via.placeholder.com/150';
          }
        }
        if (child.type === 2 && child.url && child.custom_id) {
          delete child.custom_id;
        }
      }
    }
    if (component.type === 2 && component.url && component.custom_id) {
      delete component.custom_id;
    }
  }
}

function flattenErrors(obj, path = '') {
  const errors = [];
  for (const key in obj) {
    const newPath = path ? `${path}.${key}` : key;
    if (obj[key]._errors) {
      errors.push(`${newPath}: ${obj[key]._errors.map(e => e.message).join(', ')}`);
    }
    if (typeof obj[key] === 'object' && !obj[key]._errors) {
      errors.push(...flattenErrors(obj[key], newPath));
    }
  }
  return errors;
}