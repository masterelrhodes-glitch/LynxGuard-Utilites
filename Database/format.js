const mongoose = require('mongoose');

const formatSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  isEmbed: {
    type: Boolean,
    required: true,
    default: false
  },
  content: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

formatSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Format', formatSchema);