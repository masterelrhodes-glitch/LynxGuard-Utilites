const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    required: true,
    unique: true
  },
  threadId: {
    type: String,
    required: true
  },
  discordUserId: {
    type: String,
    required: true
  },
  discordUsername: {
    type: String,
    required: true
  },
  robloxUserId: {
    type: String,
    required: true
  },
  robloxUsername: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['not reviewed', 'staged', 'accepted', 'denied'],
    default: 'not reviewed'
  },
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
  applicationReviewer: {
    type: String,
    default: null
  },
  dateReviewed: {
    type: Date,
    default: null
  },
  applicationNotes: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  collection: 'applications',
  timestamps: true
});

module.exports = applicationSchema;