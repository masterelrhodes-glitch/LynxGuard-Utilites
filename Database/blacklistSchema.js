const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
  discordUserId: {
    type: String,
    required: true,
    unique: true
  },
  discordUsername: {
    type: String,
    required: true
  },
  blacklistedBy: {
    type: String,
    required: true
  },
  blacklistedByUsername: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: 'No reason provided'
  },
  blacklistedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  collection: 'blacklist',
  timestamps: true
});

module.exports = blacklistSchema;