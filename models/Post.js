const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  mediaUrl: String,
  author: String,
  upvotes: { type: Number, default: 0 },      // NOVO campo
  downvotes: { type: Number, default: 0 },    // NOVO campo
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);
