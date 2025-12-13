const mongoose = require('mongoose');

const orderLogSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  designer: { type: String, required: true },
  designerUsername: { type: String, required: true },
  customer: { type: String, required: true },
  gamepassPrice: { type: Number, required: true },
  taxedPrice: { type: Number, required: true },
  orderField: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  designerTake: { type: Number, required: true },
  status: { type: String, default: 'unpaid' },
  messageId: { type: String, required: true },
  reviewed: { type: Boolean, default: false },
  rating: { type: Number, min: 1, max: 5 },
  reviewNotes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const accountLinkSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  robloxId: { type: Number, required: true, unique: true },
  robloxUsername: { type: String, required: true },
  accountCreated: { type: Date, required: true },
  linkedAt: { type: Date, default: Date.now }
});

const customerStatsSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  ordersReviewed: { type: Number, default: 0 },
  favoriteDesigner: { type: String },
  favoriteDesignerUsername: { type: String },
  favoriteDesignerCount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const OrderLog = mongoose.model('OrderLog', orderLogSchema);
const AccountLink = mongoose.model('AccountLink', accountLinkSchema);
const CustomerStats = mongoose.model('CustomerStats', customerStatsSchema);

module.exports = { OrderLog, AccountLink, CustomerStats };