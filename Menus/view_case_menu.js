const { EmbedBuilder } = require('discord.js');
const Case = require('../Database/case');
const { description } = require('../Messages/ban');

module.exports = {
    name: 'view',            // this must match the first part of the customId: "view_case_"
    customId: 'view_case',
    description: 'Sends past moderations.',  // prefix your select uses; kept for clarity if you use it elsewhere
    async execute(interaction) {
        const rawValue = interaction.values?.[0];
        const selectedCaseId = parseInt(rawValue, 10);

        if (!rawValue || Number.isNaN(selectedCaseId)) {
            return interaction.reply({ content: 'Invalid case selected.', ephemeral: true });
        }

        const caseData = await Case.findOne({ caseId: selectedCaseId });

        if (!caseData) {
            return interaction.reply({ content: 'Case not found.', ephemeral: true });
        }

        const targetUser = await interaction.client.users.fetch(caseData.userId).catch(() => null);

        const caseEmbed = new EmbedBuilder()
            .setColor(caseData.voided ? '#808080' : '#5865F2')
            .setTitle(`Case #${caseData.caseId} - ${caseData.type.toUpperCase()}${caseData.voided ? ' (VOIDED)' : ''}`)
            .addFields(
                {
                    name: 'User',
                    value: targetUser ? `${targetUser.tag} (${targetUser.id})` : caseData.userId,
                    inline: true
                },
                {
                    name: 'Moderator',
                    value: caseData.moderatorUsername,
                    inline: true
                },
                {
                    name: 'Points Given',
                    value: caseData.points.toString(),
                    inline: true
                },
                {
                    name: 'Reason',
                    value: caseData.reason,
                    inline: false
                },
                {
                    name: 'Date',
                    value: `<t:${Math.floor(caseData.timestamp.getTime() / 1000)}:F>`,
                    inline: false
                }
            );

        if (caseData.voided) {
            const voidedBy = caseData.voidedBy
                ? await interaction.client.users.fetch(caseData.voidedBy).catch(() => null)
                : null;

            caseEmbed.addFields(
                {
                    name: 'Voided By',
                    value: voidedBy ? voidedBy.tag : 'Unknown',
                    inline: true
                },
                {
                    name: 'Voided At',
                    value: `<t:${Math.floor(caseData.voidedAt.getTime() / 1000)}:F>`,
                    inline: true
                },
                {
                    name: 'Void Reason',
                    value: caseData.voidReason || 'None provided',
                    inline: false
                }
            );
        }

        if (targetUser) {
            caseEmbed.setThumbnail(targetUser.displayAvatarURL());
        }

        await interaction.reply({ embeds: [caseEmbed], ephemeral: true });
    }
};
