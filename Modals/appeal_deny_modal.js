const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    name: 'appeal_deny_modal',
    customID: 'appeal_deny_modal_',
    async execute(interaction) {
        const [, , , userId, caseId] = interaction.customId.split('_');
        const denyReason = interaction.fields.getTextInputValue('deny_reason');

        // Validate reason length
        if (denyReason.length < 10) {
            return interaction.reply({
                content: 'Denial reason must be at least 10 characters.',
                ephemeral: true
            });
        }

        // Defer reply to give us time
        await interaction.deferReply({ ephemeral: true });

        // Notify user
        const targetUser = await interaction.client.users.fetch(userId);
        const denyEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('Ban Appeal Denied')
            .setDescription(`Your ban appeal for case #${caseId} has been denied.`)
            .addFields(
                { name: 'Case ID', value: `#${caseId}`, inline: true },
                { name: 'Reviewed By', value: interaction.user.tag, inline: true },
                { name: 'Reason', value: denyReason, inline: false }
            )
            .setTimestamp();

        try {
            await targetUser.send({ embeds: [denyEmbed] });
        } catch (err) {
            console.log('[APPEAL] Could not DM user:', err.message);
        }

        // Find the original appeal message in the channel
        try {
            const channel = interaction.channel;
            const messages = await channel.messages.fetch({ limit: 100 });
            
            // Find message with the appeal buttons for this user/case
            const appealMessage = messages.find(msg => 
                msg.components.length > 0 &&
                msg.components.some(row => 
                    row.components.some(btn => 
                        (btn.customId === `appeal_deny_${userId}_${caseId}` ||
                         btn.customId === `appeal_accept_${userId}_${caseId}`) &&
                        !btn.disabled // Only find if buttons aren't already disabled
                    )
                )
            );

            if (!appealMessage) {
                return interaction.editReply({ 
                    content: '⚠️ Could not find the original appeal message to update. User has been notified of the denial.' 
                });
            }

            const components = appealMessage.components;
            
            // Find the button row (regular ActionRow, not Components v2)
            let buttonRowIndex = -1;
            for (let i = components.length - 1; i >= 0; i--) {
                if (components[i].type === 1) { // Type 1 = regular ActionRow
                    buttonRowIndex = i;
                    break;
                }
            }

            if (buttonRowIndex !== -1) {
                // Create disabled buttons
                const updatedButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`appeal_accept_${userId}_${caseId}`)
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`appeal_deny_${userId}_${caseId}`)
                            .setLabel('Deny')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`appeal_viewcases_${userId}`)
                            .setLabel('View Cases')
                            .setStyle(ButtonStyle.Secondary)
                    );

                // Preserve Components v2 structure if it exists
                const updatePayload = {};
                
                if (appealMessage.flags?.has(MessageFlags.IsComponentsV2)) {
                    updatePayload.flags = MessageFlags.IsComponentsV2;
                }

                // Build new components array
                const newComponents = [];
                for (let i = 0; i < components.length; i++) {
                    if (i === buttonRowIndex) {
                        newComponents.push(updatedButtons);
                    } else {
                        newComponents.push(components[i]);
                    }
                }

                updatePayload.components = newComponents;

                await appealMessage.edit(updatePayload);
            }

            // Post denial message in channel
            await channel.send(`❌ Appeal denied by ${interaction.user}.\n**Reason:** ${denyReason}`);

        } catch (err) {
            console.error('[APPEAL] Failed to update message:', err);
            return interaction.editReply({ 
                content: '⚠️ User was notified, but there was an error updating the appeal message.' 
            });
        }

        await interaction.editReply({ 
            content: '✅ Appeal has been denied and user has been notified.' 
        });
    }
};