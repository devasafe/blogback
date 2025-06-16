const express = require('express');
const router = express.Router();
const ForumPost = require('../models/Post'); // Aqui você usa o modelo dos posts do fórum

router.get('/top', async (req, res) => {
  try {
    const posts = await ForumPost.find()
      .sort({ votes: -1 }) // Ordena por mais votos
      .limit(10);

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar posts mais votados' });
  }
});

module.exports = router;
