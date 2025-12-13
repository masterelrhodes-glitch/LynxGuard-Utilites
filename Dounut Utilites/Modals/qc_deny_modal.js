const { EmbedBuilder, MessageFlags } = require('discord.js');
const { Routes } = require('discord-api-types/v10');

function buildQcComponents({ qcRole, fieldDisplay, designer, customer, status, threadUrl }) {
  const buttons = [
    {
      style: 3,
      type: 2,
      label: 'Approve',
      custom_id: 'qc_approve_button',
      disabled: status !== 'Awaiting Evaluation'
    },
    {
      style: 4,
      type: 2,
      label: 'Deny',
      custom_id: 'qc_deny_button',
      disabled: status !== 'Awaiting Evaluation'
    }
  ];

  if (threadUrl) {
    buttons.push({
      style: 5,
      type: 2,
      label: 'View Work',
      url: threadUrl
    });
  }

  return [
    {
      type: 10,
      content: `<@&${qcRole}>`
    },
    {
      type: 17,
      components: [
        {
          type: 12,
          items: [
            {
              media: {
                url: 'https://media.discordapp.net/attachments/1443101026918994055/1443101027497934918/image.webp?ex=6927d810&is=69268690&hm=9bc2e20a0859ee688cf40ac00a5f52bb93f81d709ac6111615bbf418b3408eb7&=&format=webp'
              }
            }
          ]
        },
        {
          type: 10,
          content:
            `## <:OrbitLogo2:1443093571761733672> Quality Control - ${fieldDisplay}\n\n` +
            `${designer} has requested an evaluation of their work for ${customer}. ` +
            `Please review the product and chat with the designer if required to ensure the product meets **Orbit Studio** standards. `
        },
        {
          type: 14
        },
        {
          type: 10,
          content:
            `**Designer:** ${designer} \`${designer.id}\`\n` +
            `**Customer:** ${customer} \`${customer.id}\`\n` +
            `**Status:** ${status}`
        },
        {
          type: 14
        },
        {
          type: 1,
          components: buttons
        }
      ],
      accent_color: 5193164
    }
  ];
}

module.exports = {
  name: 'qc',
  description: 'Handles QC deny modal submission',

  async execute(interaction) {
    const reason = interaction.fields.getTextInputValue('deny_reason');

    if (!interaction.message) {
      return interaction.reply({ content: 'Unable to locate the original QC message.', flags: 64 });
    }

    const qcData = interaction.client.qcData?.[interaction.message.id];

    if (!qcData) {
      return interaction.reply({ content: 'QC data not found. This request may be outdated.', flags: 64 });
    }

    if (interaction.user.id === qcData.designerId) {
      return interaction.reply({ content: 'You cannot deny your own QC request.', flags: 64 });
    }

    await interaction.deferUpdate();

    const thread = interaction.guild.channels.cache.get(qcData.threadId);
    const designer = await interaction.guild.members.fetch(qcData.designerId);
    const customer = await interaction.guild.members.fetch(qcData.customerId);

    const deniedEmbed = new EmbedBuilder()
      .setTitle('Work Denied')
      .setDescription(
        `Your ${qcData.field.toLowerCase()} work has been reviewed and unfortunately does not meet our quality standards at this time. ` +
        `Please review the feedback below and make the necessary improvements before resubmitting.`
      )
      .addFields(
         { name: 'Denied By', value: `<@${interaction.user.id}>`, inline: true },
         { name: 'Customer', value: `<@${customer.user.id}>`, inline: true },
         { 
         name: 'Reason', 
        value: '```\n' + reason + '\n```', 
        inline: false 
        }
      )
      .setColor('#2f3136')
      .setTimestamp();

    try {
      await designer.user.send({ embeds: [deniedEmbed] });
    } catch (err) {
      console.log(`Could not DM designer ${designer.user.tag}:`, err);
    }

    const qcRole = '1443099145039646881';
    const threadUrl = `https://discord.com/channels/${interaction.guild.id}/${qcData.threadId}`;

    await interaction.client.rest.patch(
      Routes.channelMessage(interaction.channelId, interaction.message.id),
      {
        body: {
          flags: MessageFlags.IsComponentsV2,
          components: buildQcComponents({
            qcRole,
            fieldDisplay: qcData.field,
            designer,
            customer,
            status: 'Denied',
            threadUrl
          })
        }
      }
    );

    if (thread) {
      await thread.setLocked(true).catch(() => {});
      await thread.setArchived(true).catch(() => {});
    }
  }
};
