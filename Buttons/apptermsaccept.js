const { MessageFlags, ChannelType } = require('discord.js');
const { applicationStates } = require('../Utils/applicationState');
const mongoose = require('mongoose');

const APPLICATION_CHANNEL_ID = '1451207579467518042';
const APPLICATION_TAG_ID = '1451815611419197502';

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true },
  threadId: { type: String, required: true },
  discordUserId: { type: String, required: true },
  discordUsername: { type: String, required: true },
  robloxUserId: { type: String, required: true },
  robloxUsername: { type: String, required: true },
  status: { type: String, enum: ['not reviewed', 'staged', 'accepted', 'denied'], default: 'not reviewed' },
  answers: {
    pastSupport: String,
    serversWorked: String,
    discordJsKnowledge: String,
    question3: String,
    question4: String,
    question5: String,
    question6: String,
    question7: String
  },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'applications', timestamps: true });

let applicationConnection = null;

async function getApplicationConnection() {
  if (!applicationConnection || applicationConnection.readyState === 0) {
    applicationConnection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  }
  return applicationConnection;
}

function generateApplicationId() {
  return `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

module.exports = {
  customID: 'apptermsaccept',
  skipSplit: false,
  async execute(interaction, client, args) {
    const userId = args && args[0] ? args[0] : interaction.user.id;
    const state = applicationStates.get(userId);
    
    console.log('[APP_TERMS_ACCEPT] Button clicked by:', interaction.user.id);
    console.log('[APP_TERMS_ACCEPT] Target userId from args:', userId);
    
    if (userId !== interaction.user.id) {
      return await interaction.reply({
        content: 'This is not your application.',
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
      await interaction.deferUpdate();
      await interaction.message.delete().catch(() => {});

      console.log('[APP_TERMS_ACCEPT] Fetching guild and channel');

      const guild = await interaction.client.guilds.fetch(state.guildId);
      const applicationChannel = await guild.channels.fetch(APPLICATION_CHANNEL_ID);

      if (!applicationChannel) {
        throw new Error('Application channel not found');
      }

      const applicationId = generateApplicationId();

      console.log('[APP_TERMS_ACCEPT] Generated application ID:', applicationId);

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
                content: `# <:file:1451072954426458132> Support Applications\n\n### <:Discord:1451072525454016674>  Account Information\n- Discord User: <@${userId}> \`(${userId})\`\n- Account Made: ${state.accountCreated}\n- Joined Server: ${state.joinedServer}\n\n<:prestige_roblox:1451802498083061810>  **Roblox Information:**\n- Roblox Username: ${state.userData.robloxUsername || 'Unknown'}\n- Account Made: ${state.userData.robloxAccountCreated || 'Unknown'}\n-# Application ID: \`${applicationId}\`\n\n`
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
                custom_id: `dmuser:${userId}`
              },
              {
                style: 4,
                type: 2,
                label: "Delete Application",
                custom_id: `deleteapp:${userId}`
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
                custom_id: `stageapp:${userId}`
              }
            ]
          }
        ]
      };

      console.log('[APP_TERMS_ACCEPT] Creating thread');

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

      console.log('[APP_TERMS_ACCEPT] Thread created with ID:', thread.id);

      const conn = await getApplicationConnection();
      const Application = conn.model('Application', applicationSchema);

      const newApplication = new Application({
        applicationId: applicationId,
        threadId: thread.id,
        discordUserId: userId,
        discordUsername: interaction.user.username,
        robloxUserId: state.userData.ruid,
        robloxUsername: state.userData.robloxUsername || 'Unknown',
        status: 'not reviewed',
        answers: state.answers
      });

      await newApplication.save();

      console.log('[APP_TERMS_ACCEPT] Application saved to database');

      await interaction.user.send(`## <:Logo:1447758148722233425>  Application Submitted\n\nYour application has been successfully received. Thank you for your interest in joining our support team. Our staff will review your submission, and you will be contacted if you are selected to move forward.\n\nApplication ID: \`${applicationId}\``);

      applicationStates.delete(userId);

      console.log('[APP_TERMS_ACCEPT] Application process complete');

    } catch (error) {
      console.error('[APP_TERMS_ACCEPT] Error submitting application:', error);
      console.error('[APP_TERMS_ACCEPT] Error stack:', error.stack);
      await interaction.user.send(' An error occurred while submitting your application. Please contact an administrator.');
      applicationStates.delete(userId);
    }
  }
};