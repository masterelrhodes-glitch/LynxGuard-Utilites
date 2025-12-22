const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

const STAGED_TAG_ID = '1451815623280562246';
const ACCEPTED_TAG_ID = '1451815721700032552';
const DENIED_TAG_ID = '1451815696030765158';

const ACCEPTED_ROLES = [
  '1448100092358823966',
  '1448096782197330032',
  '1448906996421099561'
];

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true },
  threadId: { type: String, required: true },
  discordUserId: { type: String, required: true },
  discordUsername: { type: String, required: true },
  robloxUserId: { type: String, required: true },
  robloxUsername: { type: String, required: true },
  status: { type: String, enum: ['not reviewed', 'staged accepted', 'staged denied', 'accepted', 'denied'], default: 'not reviewed' },
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
  applicationReviewer: { type: String, default: null },
  dateReviewed: { type: Date, default: null },
  applicationNotes: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'applications', timestamps: true });

let applicationConnection = null;

async function getApplicationConnection() {
  if (!applicationConnection || applicationConnection.readyState === 0) {
    applicationConnection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  }
  return applicationConnection;
}

module.exports = {
  customID: 'processapps',
  skipSplit: false,
  async execute(interaction, client, args) {
    try {
      const authorizedUserId = args && args[0] ? args[0] : null;

      if (authorizedUserId && authorizedUserId !== interaction.user.id) {
        return await interaction.reply({
          content: 'This button is not for you.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const conn = await getApplicationConnection();
      const Application = conn.model('Application', applicationSchema);

      const stagedApplications = await Application.find({
        status: { $in: ['staged accepted', 'staged denied'] }
      });

      if (stagedApplications.length === 0) {
        return await interaction.editReply({
          content: 'No staged applications found to process.',
          flags: MessageFlags.Ephemeral
        });
      }

      let processedCount = 0;

      for (const app of stagedApplications) {
        try {
          const isAccepted = app.status === 'staged accepted';
          const newStatus = isAccepted ? 'accepted' : 'denied';
          const newTagId = isAccepted ? ACCEPTED_TAG_ID : DENIED_TAG_ID;

          app.status = newStatus;
          await app.save();

          try {
            const thread = await client.channels.fetch(app.threadId);
            
            if (thread) {
              const currentTags = thread.appliedTags || [];
              const newTags = currentTags.filter(tag => tag !== STAGED_TAG_ID);
              
              if (!newTags.includes(newTagId)) {
                newTags.push(newTagId);
              }

              await thread.setAppliedTags(newTags);

              await thread.send(`This application has been processed by ${interaction.user}.`);

              await thread.setLocked(true);
              await thread.setArchived(true);
            }
          } catch (threadError) {
            console.error(`Error updating thread ${app.threadId}:`, threadError);
          }

          if (isAccepted) {
            try {
              const guild = interaction.guild;
              if (guild) {
                const member = await guild.members.fetch(app.discordUserId);
                
                if (member) {
                  await member.roles.add(ACCEPTED_ROLES);
                  console.log(`Assigned roles to ${app.discordUsername} (${app.discordUserId})`);
                }
              }
            } catch (roleError) {
              console.error(`Error assigning roles to ${app.discordUserId}:`, roleError);
            }
          }

          try {
            const applicant = await client.users.fetch(app.discordUserId);
            
            if (applicant) {
              const reasonText = app.applicationNotes ? app.applicationNotes : 'No reason provided';
              let dmMessage;
              
              if (isAccepted) {
                dmMessage = `## <:Tos:1451072625978904587> Application Outcome\nHello ${applicant},\n> Thank you for applying. We're pleased to inform you that your application has been **accepted**. You've been selected to move forward, and a member of our staff will contact you shortly with next steps and onboarding information.\n> \n> We appreciate your interest and look forward to working with you.\n- **Reason:** ${reasonText}\n-# Sincerely,\n-# <:Logo:1447758148722233425> LynxGuard Administration`;
              } else {
                dmMessage = `## <:Tos:1451072625978904587> Application Outcome\nHello ${applicant},\n> Thank you for taking the time to apply. After careful review, we've decided **not to move forward** with your application at this time. We appreciate your interest and encourage you to apply again in the future if circumstances change.\n- **Reason:** ${reasonText}\n-# Sincerely,\n-# <:Logo:1447758148722233425> LynxGuard Administration`;
              }

              await applicant.send(dmMessage);
            }
          } catch (dmError) {
            console.error(`Error sending DM to ${app.discordUserId}:`, dmError);
          }

          processedCount++;

        } catch (appError) {
          console.error(`[PROCESS_APPS] Error processing application ${app.applicationId}:`, appError);
        }
      }

      await interaction.editReply({
        content: `Successfully processed **${processedCount}** application(s).`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Error processing applications:', error);
      
      await interaction.editReply({
        content: 'An error occurred while processing applications. Please contact an administrator.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
};