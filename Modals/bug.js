const {
  EmbedBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const { randomUUID } = require('crypto');

const BUG_FORUM_CHANNEL_ID = '1451067362496479397';
const BUG_TAG_ID = '1451067468981342320';
const SENTRY_ORG = 'lynxgaurd';
const SENTRY_PROJECT = 'node';
const FIXED_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1451031429105582221/1451378519266426900/image.png?ex=6945f514&is=6944a394&hm=32e874fe64c3374754fad0e874389c785990aff414b192731ede66ed0d51cfac';

module.exports = {
  customID: 'bug',
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const errorId = interaction.fields.getTextInputValue('error_id') || null;
      const bugDescription = interaction.fields.getTextInputValue('bug_description');
      const replicateSteps = interaction.fields.getTextInputValue('replicate_steps') || 'Not provided';
      const uploadedFiles = interaction.fields.getUploadedFiles('bug_files');

      const reportId = randomUUID();

      const uploadedFileUrls = [];
      for (const [id, attachment] of uploadedFiles) {
        if (attachment && attachment.url) {
          uploadedFileUrls.push({
            url: attachment.url,
            name: attachment.name || 'Unnamed',
            id: attachment.id
          });
        }
      }

      try {
        const db = interaction.client.database.conn.db;
        
        if (!db) {
          throw new Error('Database connection not available');
        }
        
        const bugReport = {
          reportId: reportId,
          userId: interaction.user.id,
          username: interaction.user.username,
          guildId: interaction.guild.id,
          guildName: interaction.guild.name,
          bugDescription: bugDescription,
          replicateSteps: replicateSteps,
          errorId: errorId,
          uploadedFiles: uploadedFileUrls,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        console.log('Attempting to save bug report:', bugReport);
        await db.collection('bug_reports').insertOne(bugReport);
        console.log(`Bug report ${reportId} stored successfully`);
        interaction.client.logs?.debug(`Bug report ${reportId} stored in database`);
      } catch (dbError) {
        console.error('Full database error:', dbError);
        interaction.client.logs?.error('Error storing bug report in database:', dbError.message);
      }

      const bugForum = await interaction.guild.channels.fetch(BUG_FORUM_CHANNEL_ID);

      const user = interaction.user;
      const createdTimestamp = Math.floor(user.createdTimestamp / 1000);

      const userMediaGallery = new MediaGalleryBuilder();
      
      for (const [id, attachment] of uploadedFiles) {
        if (attachment && attachment.url) {
          userMediaGallery.addItems((item) => {
            const builder = item.setURL(attachment.url);
            if (attachment.name) {
              builder.setDescription(attachment.name);
            }
            return builder;
          });
        }
      }

      const embedMediaGallery = new MediaGalleryBuilder();
      embedMediaGallery.addItems((item) => {
        return item.setURL(FIXED_IMAGE_URL);
      });

      const container = new ContainerBuilder()
        .setAccentColor(0x37373D)
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((textDisplay) =>
              textDisplay.setContent(`# <:Tos:1451072625978904587>  Bug Report ${user.username}`)
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId(`mark_reviewed_${reportId}`)
                .setLabel('Mark as Reviewed')
                .setStyle(ButtonStyle.Secondary)
            )
        )
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(`### User Information\n- User: <@${user.id}> \`(${user.id})\`\n- Account creation: <t:${createdTimestamp}:R>`)
        )
        .addSeparatorComponents((separator) =>
          separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
        )
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((textDisplay) =>
              textDisplay.setContent(
                `## Bug Information\n` +
                `**Claimed bug:**\n\`\`\`${bugDescription}\`\`\`\n` +
                `**How to replicate:**\n${replicateSteps}\n` +
                `-# Report ID: ${reportId}`
              )
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId(`close_report_${reportId}`)
                .setLabel('Close Report')
                .setStyle(ButtonStyle.Danger)
            )
        );

      const containerData = container.toJSON();
      

      const components = [containerData];

      if (errorId) {
        const errorData = await fetchSentryError(errorId, interaction.client);
        if (errorData) {
          const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF4949)
            .addTextDisplayComponents((textDisplay) =>
              textDisplay.setContent(`## Error Information:\n${errorData}`)
            );

          components.push(errorContainer.toJSON());
        }
      }

      const thread = await bugForum.threads.create({
        name: `Bug Report | ${user.username}`,
        message: {
          components: components,
          flags: MessageFlags.IsComponentsV2
        },
        appliedTags: [BUG_TAG_ID]
      });

      if (uploadedFileUrls.length > 0) {
        const photoEmbeds = [];
        for (const file of uploadedFileUrls) {
          const embed = new EmbedBuilder()
            .setImage(file.url)
            .setColor(0x37373D);
          
          if (file.name) {
            embed.setFooter({ text: file.name });
          }
          
          photoEmbeds.push(embed);
        }

        await thread.send({
          content: `**Uploaded Screenshots** (${photoEmbeds.length} image${photoEmbeds.length !== 1 ? 's' : ''})`,
          embeds: photoEmbeds
        });
      }

      await interaction.editReply({
        content: 
          `## :support_notify: Bug Reported\n` +
          `-# Thanks for being part of the community that makes LynxGuard great!\n` +
          `> You will receive updates as we handle the reported issue. When a fix is pushed you will be the first notified. You will receive DMs to track updates and the issue.\n` +
          `- Report ID: ${reportId}`,
        flags: MessageFlags.Ephemeral
      });

      const dmEmbed = new EmbedBuilder()
        .setTitle('Bug Report Received')
        .setDescription(
          `Thank you for reporting this issue! Your feedback helps us improve LynxGuard and keep everything running smoothly. Our development team has been notified and will review it as soon as possible.\n\n` +
          `-# Report ID: ${reportId}`
        )
        .setAuthor({
          name: `@${user.username}`,
          iconURL: user.displayAvatarURL()
        })
        .setColor(0x37373D);

      await user.send({ embeds: [dmEmbed] }).catch(() => {
        interaction.client.logs?.debug(`Could not DM user ${user.id} about bug report`);
      });

    } catch (error) {
      console.error('Error processing bug report:', error);
      await interaction.editReply({
        content: `An error occurred while processing your bug report: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

async function fetchSentryError(errorId, client) {
  try {
    const issuesUrl = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`;
    
    const response = await fetch(issuesUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.SENTRY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      client.logs?.error(`Failed to fetch Sentry issues: ${response.status}`);
      return null;
    }

    const issues = await response.json();
    
    let matchingIssue = null;
    let matchingEvent = null;

    for (const issue of issues) {
      const eventUrl = `https://sentry.io/api/0/issues/${issue.id}/events/latest/`;
      const eventResponse = await fetch(eventUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.SENTRY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!eventResponse.ok) continue;

      const event = await eventResponse.json();
      
      if (event.tags) {
        const tags = {};
        event.tags.forEach(tag => {
          tags[tag.key] = tag.value;
        });

        const eventErrorId = tags.error_id || tags.custom_error_id;
        
        if (eventErrorId === errorId) {
          matchingIssue = issue;
          matchingEvent = event;
          break;
        }
      }
    }

    if (!matchingIssue || !matchingEvent) {
      client.logs?.debug(`No matching issue found for error ID: ${errorId}`);
      return null;
    }
    
    const tags = {};
    if (matchingEvent.tags) {
      matchingEvent.tags.forEach(tag => {
        tags[tag.key] = tag.value;
      });
    }

    const contexts = matchingEvent.contexts || {};
    const errorTracking = contexts.error_tracking || {};
    const guildContext = contexts.guild || {};
    const channelContext = contexts.channel || {};
    
    const fileName = tags.error_file || errorTracking.file || 'Unknown';
    const errorLine = tags.error_line || errorTracking.errorLine || '??';
    const errorColumn = tags.error_column || errorTracking.errorColumn || '??';
    const commandName = tags.command_name || errorTracking.command || 'Unknown';
    const errorType = matchingIssue.title || 'Unknown Error';
    const weeklyCount = matchingIssue.count || 1;
    const guildName = tags.guild_name || guildContext.name || 'Unknown Server';
    const channelName = tags.channel_name || channelContext.name || 'unknown-channel';
    const lastSeen = new Date(matchingIssue.lastSeen);
    const timestamp = Math.floor(lastSeen.getTime() / 1000);
    
    const lineInfo = errorLine !== '??' ? `${errorLine}${errorColumn !== '??' ? `:${errorColumn}` : ''}` : '??';

    let stackTrace = matchingIssue.culprit || errorTracking.errorMessage || 'No details available';
    if (matchingEvent.entries && matchingEvent.entries.length > 0) {
      const entry = matchingEvent.entries[0];
      if (entry.data && entry.data.values) {
        const exceptionData = entry.data.values[0];
        if (exceptionData && exceptionData.stacktrace) {
          const frames = exceptionData.stacktrace.frames || [];
          stackTrace = frames.slice(-3).map(f => 
            `${f.filename}:${f.lineno} in ${f.function || 'anonymous'}`
          ).join('\n');
        }
      }
    }

    return (
      `**Error Type:** ${errorType}\n` +
      `**Last Seen:** <t:${timestamp}:R>\n` +
      `**File:** ${fileName}\n` +
      `**Line:** ${lineInfo}\n` +
      `**Command:** ${commandName}\n` +
      `**Guild:** ${guildName}\n` +
      `**Channel:** ${channelName}\n` +
      `**Occurrences this week:** ${weeklyCount}\n\n` +
      `**Stack Trace:**\n\`\`\`\n${stackTrace}\n\`\`\``
    );

  } catch (error) {
    client.logs?.error('Error fetching Sentry data:', error);
    return null;
  }
}