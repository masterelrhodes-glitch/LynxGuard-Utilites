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
        
        if (this.processedIssues.has(errorId)) continue;
        
        const exists = await this.checkThreadExists(errorId);
        if (exists) {
          this.processedIssues.add(errorId);
          this.client.logs.debug(`Thread already exists for error ${errorId}, skipping`);
          continue;
        }
        
        await this.createErrorThread(issue, latestEvent, errorId);
        this.processedIssues.add(errorId);
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
        if (thread.name.includes(errorId)) {
          return true;
        }
      }
      
      const archivedThreads = await forum.threads.fetchArchived({ limit: 100 });
      
      for (const thread of archivedThreads.threads.values()) {
        if (thread.name.includes(errorId)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.client.logs.error('Error checking thread existence:', error.message);
      return false;
    }
  }

  async createErrorThread(issue, event, errorId) {
    try {
      const guild = await this.client.guilds.fetch(this.GUILD_ID);
      const forum = await guild.channels.fetch(this.FORUM_CHANNEL_ID);

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

      await forum.threads.create({
        name: `Error ${errorId}`,
        message: {
          content: `<@&${this.PING_ROLE_ID}>`,
          embeds: [embed],
          components: [row]
        },
        appliedTags: [this.UNRESOLVED_TAG_ID]
      });

      this.client.logs.success(`Created thread for error ${errorId}`);
    } catch (error) {
      this.client.logs.error('Error creating thread:', error.message);
      this.client.logs.error('Stack trace:', error.stack);
    }
  }
}

module.exports = SentryPoller;