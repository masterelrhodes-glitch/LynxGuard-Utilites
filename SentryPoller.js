const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

class SentryPoller {
  constructor(client) {
    this.client = client;
    this.SENTRY_ORG = 'lynxgaurd';
    this.SENTRY_PROJECT = 'node';
    this.SENTRY_API_TOKEN = process.env.SENTRY_API_TOKEN;
    
    if (!this.SENTRY_API_TOKEN) {
      throw new Error('SENTRY_API_TOKEN is not set in .env file');
    }
    this.GUILD_ID = '1446351663622389770';
    this.FORUM_CHANNEL_ID = '1449630669318914068';
    this.UNRESOLVED_TAG_ID = '1449647367866552330';
    this.REVIEWED_TAG_ID = '1449647392063357083';
    this.RESOLVED_TAG_ID = '1449647407859109940';
    this.PING_ROLE_ID = '1446352448037064755';
    this.REPO_CHANNEL_ID = '1448109227150282812';
    this.processedIssues = new Set();
    this.isPolling = false;
  }

  async start() {
    if (this.isPolling) return;
    this.isPolling = true;
    
    this.client.logs.info('Starting Sentry polling every 20 seconds');
    this.lastPollTime = new Date();
    this.poll();
    this.interval = setInterval(() => this.poll(), 20000);
  }

  stop() {
    this.isPolling = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.client.logs.info('Stopped Sentry polling');
    }
  }

  async poll() {
    try {
      const issues = await this.fetchSentryIssues();
      const foundErrors = [];
      
      for (const issue of issues) {
        const lastSeen = new Date(issue.lastSeen);
        const timeSinceLastSeen = Date.now() - lastSeen.getTime();
        
        if (timeSinceLastSeen > 30000) {
          continue;
        }
        
        const latestEvent = await this.fetchLatestEvent(issue.id);
        if (!latestEvent) continue;
        
        const tags = {};
        if (latestEvent.tags) {
          latestEvent.tags.forEach(tag => {
            tags[tag.key] = tag.value;
          });
        }
        
        const errorId = tags.error_id || tags.custom_error_id || issue.id;
        
        const threadCheck = await this.checkThreadExists(errorId);
        
        const guildId = tags.guild_id || latestEvent.contexts?.guild?.id || 'Unknown';
        const guildName = tags.guild_name || latestEvent.contexts?.guild?.name || 'Unknown Server';
        const userId = tags.user_id || latestEvent.user?.id || 'Unknown';
        const userName = tags.last_triggered_by || latestEvent.user?.username || 'Unknown';
        
        if (threadCheck.exists) {
          const timeSinceLastSeenMs = Date.now() - lastSeen.getTime();
          const secondsAgo = Math.floor(timeSinceLastSeenMs / 1000);
          let timeAgoStr;
          
          if (secondsAgo < 60) {
            timeAgoStr = `${secondsAgo} seconds ago`;
          } else if (secondsAgo < 3600) {
            const minutesAgo = Math.floor(secondsAgo / 60);
            timeAgoStr = `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
          } else {
            const hoursAgo = Math.floor(secondsAgo / 3600);
            timeAgoStr = `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`;
          }
          
          try {
            const userMention = userId !== 'Unknown' ? `<@${userId}>` : userName;
            const timestamp = Math.floor(lastSeen.getTime() / 1000);
            
            await threadCheck.thread.send({
              content: `**Error triggered again**\n` +
                       `**Time:** <t:${timestamp}:R> (${timeAgoStr})\n` +
                       `**User:** ${userMention} \`(${userId})\`\n` +
                       `**Guild:** ${guildName} \`(${guildId})\`\n` +
                       `**Occurrences this week:** ${issue.count || 1}`
            });
            
            this.client.logs.debug(`Sent recurrence message to thread for error ${errorId}`);
          } catch (err) {
            this.client.logs.error(`Could not send message to thread for error ${errorId}: ${err.message}`);
          }
          
          if (guildId !== 'Unknown') {
            try {
              const errorGuild = await this.client.guilds.fetch(guildId);
              const errorOwner = await errorGuild.fetchOwner();
              
              await errorOwner.send({
                content: `**Error \`${errorId}\` was triggered again in ${guildName}**\n` +
                         `This error already has an open thread: ${threadCheck.thread.url}\n` +
                         `Please check the thread for more details.`
              }).catch(err => {
                this.client.logs.debug(`Could not DM server owner about error recurrence: ${err.message}`);
              });
            } catch (err) {
              this.client.logs.debug(`Could not notify server owner about error recurrence: ${err.message}`);
            }
          }
          
          continue;
        }
        
        this.client.logs.info(` Attempting to create thread for error ${errorId}`);
        
        await this.createErrorThread(issue, latestEvent, errorId);
        this.client.logs.info(`Created new thread for **Error ${errorId}** - Guild ${guildName} (${guildId}) - User ${userName} (${userId})`);
      }
    } catch (error) {
      this.client.logs.error('Error polling Sentry:', error.message);
      this.client.logs.error('Stack:', error.stack);
    }
  }

  async fetchSentryIssues() {
    const url = `https://sentry.io/api/0/projects/${this.SENTRY_ORG}/${this.SENTRY_PROJECT}/issues/`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.SENTRY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchLatestEvent(issueId) {
    try {
      const url = `https://sentry.io/api/0/issues/${issueId}/events/latest/`;
      
      this.client.logs.debug(`Fetching latest event from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.SENTRY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        this.client.logs.error(`Failed to fetch latest event for ${issueId}: ${response.status}`);
        return null;
      }

      const event = await response.json();
      
      this.client.logs.debug(`Event tags for issue ${issueId}:`, JSON.stringify(event.tags, null, 2));
      this.client.logs.debug(`Event user for issue ${issueId}:`, JSON.stringify(event.user, null, 2));
      this.client.logs.debug(`Event contexts for issue ${issueId}:`, JSON.stringify(event.contexts, null, 2));
      
      return event;
    } catch (error) {
      this.client.logs.error(`Error fetching latest event for ${issueId}:`, error.message);
      return null;
    }
  }

  async checkThreadExists(errorId) {
    try {
      const guild = await this.client.guilds.fetch(this.GUILD_ID);
      const forum = await guild.channels.fetch(this.FORUM_CHANNEL_ID);
      
      const activeThreads = await forum.threads.fetchActive();
      
      for (const thread of activeThreads.threads.values()) {
        if (thread.name.includes(errorId) && !thread.name.includes('[RESOLVED]')) {
          return { exists: true, thread: thread };
        }
      }
      
      const archivedThreads = await forum.threads.fetchArchived({ limit: 100 });
      
      for (const thread of archivedThreads.threads.values()) {
        if (thread.name.includes(errorId) && !thread.name.includes('[RESOLVED]')) {
          return { exists: true, thread: thread };
        }
      }
      
      return { exists: false, thread: null };
    } catch (error) {
      this.client.logs.error('Error checking thread existence:', error.message);
      return { exists: false, thread: null };
    }
  }

  async createErrorThread(issue, event, errorId) {
    try {
      this.client.logs.info(`🔧 [Thread Creation] Starting for error ${errorId}`);
      
      this.client.logs.debug(`[Thread Creation] Fetching guild ${this.GUILD_ID}`);
      const guild = await this.client.guilds.fetch(this.GUILD_ID);
      this.client.logs.debug(`[Thread Creation] Guild fetched: ${guild.name}`);
      
      this.client.logs.debug(`[Thread Creation] Fetching forum channel ${this.FORUM_CHANNEL_ID}`);
      const forum = await guild.channels.fetch(this.FORUM_CHANNEL_ID);
      this.client.logs.debug(`[Thread Creation] Forum fetched: ${forum.name} (Type: ${forum.type})`);
      
      const botPermissions = forum.permissionsFor(this.client.user);
      this.client.logs.debug(`[Thread Creation] Bot permissions in forum:`, {
        VIEW_CHANNEL: botPermissions.has('ViewChannel'),
        SEND_MESSAGES: botPermissions.has('SendMessages'),
        CREATE_PUBLIC_THREADS: botPermissions.has('CreatePublicThreads'),
        SEND_MESSAGES_IN_THREADS: botPermissions.has('SendMessagesInThreads'),
        MANAGE_THREADS: botPermissions.has('ManageThreads')
      });

      const lastSeen = new Date(issue.lastSeen);
      const timestamp = Math.floor(lastSeen.getTime() / 1000);

      const tags = {};
      if (event.tags) {
        event.tags.forEach(tag => {
          tags[tag.key] = tag.value;
        });
      }

      const contexts = event.contexts || {};
      const errorTracking = contexts.error_tracking || {};
      const guildContext = contexts.guild || {};
      const channelContext = contexts.channel || {};
      const interactionContext = contexts.interaction || {};

      const userId = tags.user_id || event.user?.id || 'Unknown';
      const userName = tags.last_triggered_by || event.user?.username || 'Unknown';
      
      const guildId = tags.guild_id || guildContext.id || 'Unknown';
      const guildName = tags.guild_name || guildContext.name || 'Unknown Server';
      
      const channelId = tags.channel_id || channelContext.id || interactionContext.channelId || 'Unknown';
      const channelName = tags.channel_name || channelContext.name || 'unknown-channel';
      
      const fileName = tags.error_file || errorTracking.file || 'Unknown';
      const errorLine = tags.error_line || errorTracking.errorLine || '??';
      const errorColumn = tags.error_column || errorTracking.errorColumn || '??';
      
      const interactionType = tags.interaction_type || interactionContext.type || 'Unknown';
      const commandName = tags.command_name || interactionContext.commandName || errorTracking.command || 'Unknown';

      const weeklyCount = issue.count || 1;
      const errorType = issue.title || 'Unknown Error';
      const errorMessage = issue.culprit || errorTracking.errorMessage || 'No details available';

      let stackTrace = errorMessage;
      if (event.entries && event.entries.length > 0) {
        const entry = event.entries[0];
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

      this.client.logs.debug(`[Thread Creation] Building embed`);
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

      this.client.logs.debug(`[Thread Creation] Building select menu`);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`error_action_${errorId}`)
        .setPlaceholder('Select an action')
        .addOptions([
          {
            label: 'Review',
            value: 'review',
            description: 'Mark this error as reviewed'
          },
          {
            label: 'Resolved',
            value: 'resolved',
            description: 'Mark this error as resolved'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      this.client.logs.debug(`[Thread Creation] Creating thread with name: "Error ${errorId}"`);
      this.client.logs.debug(`[Thread Creation] Applied tags: [${this.UNRESOLVED_TAG_ID}]`);
      this.client.logs.debug(`[Thread Creation] Ping role: ${this.PING_ROLE_ID}`);

      const threadData = {
        name: `Error ${errorId}`,
        message: {
          content: `<@&${this.PING_ROLE_ID}>`,
          embeds: [embed],
          components: [row]
        },
        appliedTags: [this.UNRESOLVED_TAG_ID]
      };

      this.client.logs.debug(`[Thread Creation] Thread data prepared:`, JSON.stringify({
        name: threadData.name,
        appliedTags: threadData.appliedTags,
        hasEmbed: !!threadData.message.embeds[0],
        hasComponents: !!threadData.message.components[0]
      }, null, 2));

      const thread = await forum.threads.create(threadData);
      
      this.client.logs.success(`[Thread Creation] Successfully created thread: ${thread.name} (${thread.id})`);
      this.client.logs.debug(`[Thread Creation] Thread URL: ${thread.url}`);

    } catch (error) {
      this.client.logs.error(`[Thread Creation] FAILED for error ${errorId}`);
      this.client.logs.error(`[Thread Creation] Error type: ${error.name}`);
      this.client.logs.error(`[Thread Creation] Error message: ${error.message}`);
      this.client.logs.error(`[Thread Creation] Error code: ${error.code}`);
      this.client.logs.error(`[Thread Creation] Full stack trace:`, error.stack);
      
      if (error.rawError) {
        this.client.logs.error(`[Thread Creation] Raw API error:`, JSON.stringify(error.rawError, null, 2));
      }
      
      throw error;
    }
  }
}

module.exports = SentryPoller;