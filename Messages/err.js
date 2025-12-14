const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'err',
  description: 'Look up a Sentry error by ID',
  async execute(message, args, client) {
    const REQUIRED_ROLE_ID = '1446352448037064755';
    if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return message.reply('You do not have permission to use this command.');
    }

    let errorId;
    if (args && args.length > 0) {
      errorId = args[0];
    } else {
      const match = message.content.match(/-err\s+([A-Z0-9-]+)/i);
      if (match) {
        errorId = match[1];
      }
    }

    if (!errorId) {
      return message.reply('Please provide an error ID. Usage: `-err ERR-580B55`');
    }

    errorId = errorId.toUpperCase();

    try {
      await message.channel.sendTyping();

      const SENTRY_ORG = 'lynxgaurd';
      const SENTRY_PROJECT = 'node';
      const SENTRY_API_TOKEN = process.env.SENTRY_API_TOKEN;

      if (!SENTRY_API_TOKEN) {
        return message.reply('Sentry API token is not configured.');
      }

      const issuesUrl = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`;
      const issuesResponse = await fetch(issuesUrl, {
        headers: {
          'Authorization': `Bearer ${SENTRY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!issuesResponse.ok) {
        return message.reply('Failed to fetch data from Sentry.');
      }

      const issues = await issuesResponse.json();
      
      let matchingIssue = null;
      let matchingEvent = null;

      for (const issue of issues) {
        const latestEventUrl = `https://sentry.io/api/0/issues/${issue.id}/events/latest/`;
        const eventResponse = await fetch(latestEventUrl, {
          headers: {
            'Authorization': `Bearer ${SENTRY_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!eventResponse.ok) continue;

        const event = await eventResponse.json();
        const tags = {};
        
        if (event.tags) {
          event.tags.forEach(tag => {
            tags[tag.key] = tag.value;
          });
        }

        const eventErrorId = tags.error_id || tags.custom_error_id || issue.id;
        
        if (eventErrorId === errorId) {
          matchingIssue = issue;
          matchingEvent = event;
          break;
        }
      }

      if (!matchingIssue || !matchingEvent) {
        return message.reply(`Error \`${errorId}\` not found in Sentry.`);
      }
      const lastSeen = new Date(matchingIssue.lastSeen);
      const timestamp = Math.floor(lastSeen.getTime() / 1000);

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
      const interactionContext = contexts.interaction || {};

      const userId = tags.user_id || matchingEvent.user?.id || 'Unknown';
      const userName = tags.last_triggered_by || matchingEvent.user?.username || 'Unknown';
      
      const guildId = tags.guild_id || guildContext.id || 'Unknown';
      const guildName = tags.guild_name || guildContext.name || 'Unknown Server';
      
      const channelId = tags.channel_id || channelContext.id || interactionContext.channelId || 'Unknown';
      const channelName = tags.channel_name || channelContext.name || 'unknown-channel';
      
      const fileName = tags.error_file || errorTracking.file || 'Unknown';
      const errorLine = tags.error_line || errorTracking.errorLine || '??';
      const errorColumn = tags.error_column || errorTracking.errorColumn || '??';
      
      const interactionType = tags.interaction_type || interactionContext.type || 'Unknown';
      const commandName = tags.command_name || interactionContext.commandName || errorTracking.command || 'Unknown';

      const weeklyCount = matchingIssue.count || 1;
      const errorType = matchingIssue.title || 'Unknown Error';
      const errorMessage = matchingIssue.culprit || errorTracking.errorMessage || 'No details available';

      let stackTrace = errorMessage;
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

      const userMention = userId !== 'Unknown' ? `<@${userId}>` : userName;
      const channelMention = channelId !== 'Unknown' ? `<#${channelId}>` : channelName;
      const lineInfo = errorLine !== '??' ? `${errorLine}${errorColumn !== '??' ? `:${errorColumn}` : ''}` : '??';

      const embed = new EmbedBuilder()
        .setColor(0xFF4949)
        .setTitle(`Error \`${errorId}\``)
        .setDescription(
          `### General information\n` +
          `**Last triggered:** <t:${timestamp}:R>\n` +
          `**Last triggered by:** ${userMention} \`(${userId})\`\n` +
          `**Last triggered in:** [**${guildName}**](https://discord.gg/rGxTga9v) \`(${guildId})\`\n` +
          `**Last channel triggered in:** ${channelMention} \`(${channelId})\`\n\n` +
          `**File name:** ${fileName}\n` +
          `**Command:** ${commandName}\n` +
          `**Interaction type:** ${interactionType}\n` +
          `**Lines:** ${lineInfo}\n` +
          `**In-depth breakdown:**\n` +
          `\`\`\`\n${errorType}\n${stackTrace}\n\`\`\`\n` +
          `\n-# This error has been triggered **${weeklyCount}** times this week.`
        )
        .setTimestamp()
        .setFooter({ text: `Error ID: ${errorId}` });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      client.logs?.error('Error in -err command:', error.message);
      return message.reply('An error occurred while fetching the error data.');
    }
  }
};