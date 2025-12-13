const Format = require('../Database/format');

module.exports = {
  customID: 'format',
  async execute(interaction, client, args) {
    const isEmbed = args[1] === 'true';
    
    const formatName = interaction.fields.getTextInputValue('format_name');
    const formatContent = interaction.fields.getTextInputValue('format_content');

    if (isEmbed) {
      try {
        JSON.parse(formatContent);
      } catch (error) {
        return await interaction.reply({
          content: 'Invalid JSON format. Please check your embed structure.',
          flags: 64
        });
      }
    }

    try {
      const existingFormat = await Format.findOne({
        guildId: interaction.guildId,
        name: formatName
      });

      if (existingFormat) {
        return await interaction.reply({
          content: 'A format with this name already exists.',
          flags: 64
        });
      }

      const newFormat = new Format({
        guildId: interaction.guildId,
        name: formatName,
        isEmbed: isEmbed,
        content: formatContent,
        createdBy: interaction.user.id
      });

      await newFormat.save();

      await interaction.reply({
        content: `Format "${formatName}" has been created successfully!`,
        flags: 64
      });

    } catch (error) {
      console.error('[FORMAT] Save error:', error);
      await interaction.reply({
        content: 'An error occurred while saving the format.',
        flags: 64
      });
    }
  }
};