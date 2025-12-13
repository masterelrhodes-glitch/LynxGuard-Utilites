const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const Format = require('../../Database/format');

const ADMIN_ROLE_ID = '1446352448037064755';
const MODERATOR_ROLE_IDS = ['1446359563770265803', '1446352448037064755'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('format')
    .setDescription('Manage server formats')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new format')
        .addBooleanOption(option =>
          option
            .setName('embed')
            .setDescription('Is this an embed format?')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('send')
        .setDescription('Send a format to a channel')
        .addStringOption(option =>
          option
            .setName('format')
            .setDescription('Select a format')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to send the format to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a format')
        .addStringOption(option =>
          option
            .setName('format')
            .setDescription('Select a format to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'format') {
      try {
        const formats = await Format.find({ guildId: interaction.guildId });
        const choices = formats.map(f => ({ name: f.name, value: f._id.toString() }));
        const filtered = choices.filter(choice =>
          choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        await interaction.respond(filtered.slice(0, 25));
      } catch (error) {
        console.error('[FORMAT] Autocomplete error:', error);
        await interaction.respond([]);
      }
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return await interaction.reply({
          content: 'You do not have permission to use this command.',
          flags: 64
        });
      }

      const isEmbed = interaction.options.getBoolean('embed');
      
      const modal = new ModalBuilder()
        .setCustomId(`format_add_${isEmbed}`)
        .setTitle('Add New Format');

      const nameInput = new TextInputBuilder()
        .setCustomId('format_name')
        .setLabel('Format Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Example: How to add LynxGuard')
        .setMaxLength(100)
        .setRequired(true);

      const contentInput = new TextInputBuilder()
        .setCustomId('format_content')
        .setLabel(isEmbed ? 'Message Contents (JSON Text)' : 'Message Contents (Text)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      if (!isEmbed) {
        contentInput.setMaxLength(4000);
      }

      const nameRow = new ActionRowBuilder().addComponents(nameInput);
      const contentRow = new ActionRowBuilder().addComponents(contentInput);

      modal.addComponents(nameRow, contentRow);

      await interaction.showModal(modal);
    }

    else if (subcommand === 'send') {
      const hasPermission = MODERATOR_ROLE_IDS.some(roleId => 
        interaction.member.roles.cache.has(roleId)
      );

      if (!hasPermission) {
        return await interaction.reply({
          content: 'You do not have permission to use this command.',
          flags: 64
        });
      }

      const formatId = interaction.options.getString('format');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      try {
        const format = await Format.findById(formatId);
        
        if (!format) {
          return await interaction.reply({
            content: 'Format not found.',
            flags: 64
          });
        }

        if (format.isEmbed) {
          try {
            const messageData = JSON.parse(format.content);
            
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
            
            await channel.send(payload);
          } catch (error) {
            console.error('[FORMAT] Parse error:', error);
            return await interaction.reply({
              content: `Failed to parse embed JSON: ${error.message}`,
              flags: 64
            });
          }
        } else {
          await channel.send({ content: format.content });
        }

        await interaction.reply({
          content: `Format "${format.name}" sent to ${channel}!`,
          flags: 64
        });

      } catch (error) {
        console.error('[FORMAT] Send error:', error);
        await interaction.reply({
          content: 'An error occurred while sending the format.',
          flags: 64
        });
      }
    }

    else if (subcommand === 'delete') {
      if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return await interaction.reply({
          content: 'You do not have permission to use this command.',
          flags: 64
        });
      }

      const formatId = interaction.options.getString('format');

      try {
        const format = await Format.findById(formatId);
        
        if (!format) {
          return await interaction.reply({
            content: 'Format not found.',
            flags: 64
          });
        }

        await Format.findByIdAndDelete(formatId);

        await interaction.reply({
          content: `Format "${format.name}" has been deleted.`,
          flags: 64
        });

      } catch (error) {
        console.error('[FORMAT] Delete error:', error);
        await interaction.reply({
          content: 'An error occurred while deleting the format.',
          flags: 64
        });
      }
    }
  }
};