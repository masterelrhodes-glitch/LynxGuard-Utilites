const { MessageFlags } = require('discord.js');
const { applicationStates } = require('./applicationState');

const timeouts = new Map();

function clearUserTimeout(userId) {
  const existingTimeout = timeouts.get(userId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    timeouts.delete(userId);
  }
}

function setUserTimeout(userId, message) {
  clearUserTimeout(userId);
  
  const timeout = setTimeout(async () => {
    const state = applicationStates.get(userId);
    if (state) {
      applicationStates.delete(userId);
      timeouts.delete(userId);
      await message.author.send('Your application has been cancelled due to inactivity. You took longer than 15 minutes to respond to a question.').catch(() => {});
    }
  }, 15 * 60 * 1000);
  
  timeouts.set(userId, timeout);
}

async function handleApplicationMessage(message) {
  if (message.author.bot || !message.channel.isDMBased()) return;

  const userId = message.author.id;
  const state = applicationStates.get(userId);
  
  if (!state) return;

  clearUserTimeout(userId);

  const content = message.content.trim().toLowerCase();

  try {
    switch (state.stage) {
      case 'question1':
        await handleQuestion1(message, state, content);
        break;
      case 'question1_followup':
        await handleQuestion1Followup(message, state);
        break;
      case 'question2':
        await handleQuestion2(message, state, content);
        break;
      case 'question3':
        await handleQuestion3(message, state);
        break;
      case 'question4':
        await handleQuestion4(message, state);
        break;
      case 'question5':
        await handleQuestion5(message, state);
        break;
      case 'question6':
        await handleQuestion6(message, state);
        break;
      case 'question7':
        await handleQuestion7(message, state);
        break;
    }
  } catch (error) {
    console.error('Error handling application message:', error);
    await message.reply('An error occurred processing your response. Please try again.');
  }
}

async function handleQuestion1(message, state, content) {
  if (content !== 'yes' && content !== 'no') {
    state.attemptCounts.q1 = (state.attemptCounts.q1 || 0) + 1;
    
    if (state.attemptCounts.q1 >= 3) {
      clearUserTimeout(message.author.id);
      applicationStates.delete(message.author.id);
      return await message.reply('Application cancelled due to invalid responses.');
    }
    
    applicationStates.set(message.author.id, state);
    setUserTimeout(message.author.id, message);
    return await message.reply('Please answer with "Yes" or "No".');
  }

  state.answers.pastSupport = content;
  state.attemptCounts.q1 = 0;

  if (content === 'yes') {
    state.stage = 'question1_followup';
    applicationStates.set(message.author.id, state);
    setUserTimeout(message.author.id, message);
    return await message.reply('**1.5** Which servers have you worked as support in?');
  } else {
    state.answers.serversWorked = 'N/A';
    state.stage = 'question2';
    applicationStates.set(message.author.id, state);
    setUserTimeout(message.author.id, message);
    return await message.reply('**2.**Do you have any basic knowledge in discord js (Yes or No)?');
  }
}

async function handleQuestion1Followup(message, state) {
  state.answers.serversWorked = message.content;
  state.stage = 'question2';
  applicationStates.set(message.author.id, state);
  setUserTimeout(message.author.id, message);
  await message.reply('**2.** Do you have any basic knowledge in discord js (Yes or No)?');
}

async function handleQuestion2(message, state, content) {
  if (content !== 'yes' && content !== 'no') {
    state.attemptCounts.q2 = (state.attemptCounts.q2 || 0) + 1;
    
    if (state.attemptCounts.q2 >= 3) {
      clearUserTimeout(message.author.id);
      applicationStates.delete(message.author.id);
      return await message.reply('Application cancelled due to invalid responses.');
    }
    
    applicationStates.set(message.author.id, state);
    setUserTimeout(message.author.id, message);
    return await message.reply('Please answer with "Yes" or "No".');
  }

  state.answers.discordJsKnowledge = content;
  state.attemptCounts.q2 = 0;
  state.stage = 'question3';
  applicationStates.set(message.author.id, state);
  setUserTimeout(message.author.id, message);
  
  await message.reply('**3.** A user reports an issue that you cannot immediately reproduce. How do you communicate with them, and what steps do you take to investigate while keeping them informed?');
}

async function handleQuestion3(message, state) {
  state.answers.question3 = message.content;
  state.stage = 'question4';
  applicationStates.set(message.author.id, state);
  setUserTimeout(message.author.id, message);
  
  await message.reply('**4.** Describe a time you had to explain a technical issue or decision to someone who was frustrated or non-technical. How did you ensure clarity and de-escalation?');
}

async function handleQuestion4(message, state) {
  state.answers.question4 = message.content;
  state.stage = 'question5';
  applicationStates.set(message.author.id, state);
  setUserTimeout(message.author.id, message);
  
  await message.reply('**5.** How do you decide when an issue should be escalated to developers versus handled directly by support, and what information do you include when escalating?');
}

async function handleQuestion5(message, state) {
  state.answers.question5 = message.content;
  state.stage = 'question6';
  applicationStates.set(message.author.id, state);
  setUserTimeout(message.author.id, message);
  
  await message.reply('**6.** If you make a mistake while assisting a user, how do you handle it, and what steps do you take to prevent it from happening again?');
}

async function handleQuestion6(message, state) {
  state.answers.question6 = message.content;
  state.stage = 'question7';
  applicationStates.set(message.author.id, state);
  setUserTimeout(message.author.id, message);
  
  await message.reply('**7.** A private ERLC server owner reports that a player was falsely flagged by our system. How would you respond to the owner, and what steps would you take to review the incident?');
}

async function handleQuestion7(message, state) {
  state.answers.question7 = message.content;
  
  clearUserTimeout(message.author.id);
  
  const termsEmbed = {
    type: 17,
    components: [
      {
        type: 10,
        content: "## <:Logo:1447758148722233425>  Employee Application Terms\n\n- All support team positions are at-will and may be terminated at any time, with or without notice or cause.\n- Members are required to uphold strict professionalism, neutrality, and discretion when interacting with users, staff, and third parties.\n- All internal systems, tools, data, and procedures are confidential and may not be disclosed, copied, or misused under any circumstances.\n- Abuse of access, failure to follow protocols, negligence, or misconduct will result in immediate removal.\n- Support members must comply with all directives from senior staff and development leadership; decisions made by leadership are final and non-negotiable.\n- Inactivity, unreliability, or failure to meet expectations may result in revocation of access without warning."
      },
      {
        type: 1,
        components: [
          {
            style: 3,
            type: 2,
            label: "Accept",
            custom_id: `apptermsaccept_${message.author.id}`  
          },
          {
            style: 4,
            type: 2,
            label: "Deny",
            custom_id: `apptermsdeny_${message.author.id}`  
          }
        ]
      }
    ]
  };

  state.stage = 'terms';
  applicationStates.set(message.author.id, state);

  await message.channel.send({
    components: [termsEmbed],
    flags: MessageFlags.IsComponentsV2
  });
}

module.exports = {
  handleApplicationMessage
};