const { MessageFlags, ChannelType } = require('discord.js');
const { applicationStates } = require('../Utils/applicationState');

const APPLICATION_CHANNEL_ID = '1451207579467518042';
const APPLICATION_TAG_ID = '1451815611419197502';

module.exports = {
  customID: 'apptermsaccept',
  skipSplit: false,
  async execute(interaction, client, args) {
    const userId = args && args[0] ? args[0] : interaction.user.id;
    const state = applicationStates.get(userId);
    
    console.log('[APP_TERMS_ACCEPT] Button clicked by:', interaction.user.id);
    console.log('[APP_TERMS_ACCEPT] Target userId from args:', userId);
    console.log('[APP_TERMS_ACCEPT] State found:', !!state);
    
    if (userId !== interaction.user.id) {
      return await interaction.reply({
        content: ' This is not your application.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    if (!state) {
      return await interaction.reply({
        content: 'Application session not found.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await interaction.message.delete().catch(() => {});
      
      await interaction.user.send(' <:Tos:1451072625978904587> Terms accepted. Submitting your application...');

      console.log('[APP_TERMS_ACCEPT] Fetching guild and channel');

      const guild = await interaction.client.guilds.fetch(state.guildId);
      const applicationChannel = await guild.channels.fetch(APPLICATION_CHANNEL_ID);

      if (!applicationChannel) {
        throw new Error('Application channel not found');
      }

      console.log('[APP_TERMS_ACCEPT] Creating thread');

      const avatarUrl = state.userData.robloxAvatarUrl || 
        `https://tr.rbxcdn.com/30DAY-AvatarHeadshot-${state.userData.ruid}-Png/150/150/AvatarHeadshot/Png`;

      const applicationEmbed = {
        type: 17,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `# <:file:1451072954426458132> Support Applications\n\n### <:Discord:1451072525454016674>  Account Information\n- Discord User: <@${userId}> \`(${userId})\`\n- Account Made: ${state.accountCreated}\n- Joined Server: ${state.joinedServer}\n<:prestige_roblox:1451802498083061810>  **Roblox Information:**\n- Roblox Username: ${state.userData.robloxUsername || 'Unknown'}\n- Account Made: ${state.userData.robloxAccountCreated || 'Unknown'}\n\n`
              }
            ],
            accessory: {
              type: 11,
              media: {
                url: avatarUrl
              }
            }
          },
          {
            type: 1,
            components: [
              {
                style: 2,
                type: 2,
                label: "DM User",
                custom_id: `dmuser_${userId}`
              },
              {
                style: 4,
                type: 2,
                label: "Delete Application",
                custom_id: `deleteapp_${userId}`
              }
            ]
          }
        ]
      };

      const answersEmbed = {
        type: 17,
        components: [
          {
            type: 10,
            content: `- Have you worked in any past servers as support?\n${state.answers.pastSupport}\n\n- Which servers have you worked as support in?\n${state.answers.serversWorked}\n\n- Do you have any basic knowledge in discord js?\n${state.answers.discordJsKnowledge}\n\n- A user reports an issue that you cannot immediately reproduce. How do you communicate with them, and what steps do you take to investigate while keeping them informed?\n${state.answers.question3}\n\n- Describe a time you had to explain a technical issue or decision to someone who was frustrated or non-technical. How did you ensure clarity and de-escalation?\n${state.answers.question4}\n\n- How do you decide when an issue should be escalated to developers versus handled directly by support, and what information do you include when escalating?\n${state.answers.question5}\n\n- If you make a mistake while assisting a user, how do you handle it, and what steps do you take to prevent it from happening again?\n${state.answers.question6}\n\n- A private ERLC server owner reports that a player was falsely flagged by our system. How would you respond to the owner, and what steps would you take to review the incident?\n${state.answers.question7}`
          },
          {
            type: 1,
            components: [
              {
                type: 3,
                options: [
                  {
                    label: "Accept",
                    value: "accept"
                  },
                  {
                    label: "Deny",
                    value: "deny"
                  }
                ],
                placeholder: "Stage application",
                custom_id: `stageapp_${userId}`
              }
            ]
          }
        ]
      };

      const thread = await applicationChannel.threads.create({
        name: `${interaction.user.username}'s Application`,
        autoArchiveDuration: 60,
        message: {
          components: [applicationEmbed, answersEmbed],
          flags: MessageFlags.IsComponentsV2
        },
        appliedTags: [APPLICATION_TAG_ID],
        reason: 'Support Application Submission'
      });

      console.log('[APP_TERMS_ACCEPT] Thread created:', thread.id);
      console.log('[APP_TERMS_ACCEPT] Sending confirmation DM');

      await interaction.user.send(`## <:Logo:1447758148722233425>  Application Submitted\nYour application has been successfully received. Thank you for your interest in joining our support team. Our staff will review your submission, and you will be contacted if you are selected to move forward.`);

      applicationStates.delete(userId);

      console.log('[APP_TERMS_ACCEPT] Application process complete');

    } catch (error) {
      console.error('[APP_TERMS_ACCEPT] Error submitting application:', error);
      await interaction.user.send(' An error occurred while submitting your application. Please contact an administrator.');
      applicationStates.delete(userId);
    }
  }
};