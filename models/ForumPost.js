    const mongoose = require('mongoose');

    const forumPostSchema = new mongoose.Schema({
      title: { type: String, required: true },
      content: { type: String, required: true },
      type: { type: String, required: true }, // ESSENCIAL: Removido o 'enum' para aceitar novas categorias
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // User ID do autor do post
      votes: { type: Number, default: 0 },
      voters: { type: Map, of: String, default: {} }, // userId -> 'up' | 'down'
      file: String, // base64 ou url
    }, { timestamps: true });

    module.exports = mongoose.model('ForumPost', forumPostSchema);
    