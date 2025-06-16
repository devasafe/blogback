const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');

router.post('/:id/vote', auth, async (req, res) => {
  const { type } = req.body;
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });

    const prev = comment.voters.get(req.userId);
    if (prev === type) return res.status(400).json({ error: 'Você já votou assim' });

    if (prev === 'up') comment.votes--;
    if (prev === 'down') comment.votes++;

    if (type === 'up') comment.votes++;
    if (type === 'down') comment.votes--;

    comment.voters.set(req.userId, type);
    await comment.save();
    res.json({ votes: comment.votes });
  } catch {
    res.status(500).json({ error: 'Erro ao votar no comentário' });
  }
});

module.exports = router;
