const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Cadastro
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: 'Usuário já existe' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash });
    await user.save();

    const token = jwt.sign({ id: user._id }, 'SECRET_KEY');
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user._id }, 'SECRET_KEY');
    res.json({ token, username });
  } catch {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

module.exports = router;
