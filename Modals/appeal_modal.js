// modals/appeal_modal.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const Case = require('../Database/case');
const User = require('../Database/user');

const APPEAL_CHANNEL_ID = '1320233377290522685';

module.exports = {
  name: 'appeal',
  description: 'Receives the ban-appeal form and posts it',
  async execute(interaction) {
    // ---- parse customId: appeal_modal_USERID_CASEID ----
    const fragments = interaction.customId.split('_');
    if (fragments.length < 4) return;
    const userId = fragments[2];
    const caseId = fragments[3];

    // ---- fetch data ----
    const caseData   = await Case.findOne({ caseId: parseInt(caseId) });
    const userData   = await User.findOne({ userId, guildId: caseData?.guildId });
    const targetUser = await interaction.client.users.fetch(userId);
    const appealCh   = await interaction.client.channels.fetch(APPEAL_CHANNEL_ID);

    const whyUnban   = interaction.fields.getTextInputValue('why_unban');
    const whatLearned= interaction.fields.getTextInputValue('what_learned');

    // ---- enforce length limits ----
    if (whyUnban.length < 80) {
      return interaction.reply({
        content: 'Your “Why should we unban you?” answer must be **at least 80 characters**.',
        ephemeral: true
      });
    }
    if (whatLearned.length < 50) {
      return interaction.reply({
        content: 'Your “What have you learned?” answer must be **at least 50 characters**.',
        ephemeral: true
      });
    }

    // ---- build Components-v2 message ----
    const componentsV2 = {
      flags: MessageFlags.IsComponentsV2,
      components: [
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
              content: '## <:Ban:1443141524190789672> Ban Appeal Submitted'
            },
            {
              type: 10,
              content:
                `* **User:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
                `* **Moderator:** <@${caseData?.moderatorId}> (\`${caseData?.moderatorId}\`)\n` +
                `* **Case ID:** \`#${caseId}\`\n` +
                `* **Ban Reason:** ${caseData?.reason ?? 'No reason stored'}\n` +
                `* **Total Points:** \`${userData?.points ?? 0}\`\n` +
                `* **Why unban?** ${whyUnban}\n` +
                `* **What learned?** ${whatLearned}`
            },
            {
              type: 12,
              items: [
                {
                  media: {
                    url: 'https://media.discordapp.net/attachments/1399920144918249553/1443057063705055276/image-149.png?ex=6927af1e&is=69265d9e&hm=c7b12220d0e68cb2c834115d5408ce5f383bdaf0ca302f84af1857587b0d68fc&=&format=webp&quality=lossless&width=1724&height=79'
                  }
                }
              ]
            }
          ],
          accent_color: 5193164
        }
      ]
    };

    // ---- staff buttons (normal d.js row) ----
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`appeal_accept_${userId}_${caseId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`appeal_deny_${userId}_${caseId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`appeal_viewcases_${userId}`)
        .setLabel('View Cases')
        .setStyle(ButtonStyle.Secondary)
    );

    await appealCh.send({ ...componentsV2, components: [...componentsV2.components, row] });
    return interaction.reply({
      content: 'Your appeal has been submitted. You will be notified of the decision.',
      ephemeral: true
    });
  }
};