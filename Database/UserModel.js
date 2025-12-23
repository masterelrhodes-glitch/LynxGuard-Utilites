const { Schema, model, connection, createConnection } = require('mongoose');

const schema = new Schema({
  duid: String,
  ruid: String
});

const mongoConnection = createConnection(process.env.MONGO_URI2, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const UserModel = mongoConnection.model('verification', schema);

module.exports = UserModel;
