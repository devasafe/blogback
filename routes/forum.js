const express = require('express');
const router = express.Router();
const ForumPost = require('../models/ForumPost');
const Comment = require('../models/Comment');
const User = require('../models/User'); // Certifique-se de importar o modelo User
const auth = require('../middleware/auth'); // Seu middleware de autenticação

// Criar novo post
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, type, file } = req.body;

    // Verificação explícita para o userId, garantindo que o usuário está logado
    if (!req.userId) {
      return res.status(401).json({ error: 'Não autorizado. Faça login para criar um post.' });
    }

    const post = new ForumPost({
      title,
      content,
      type,
      user: req.userId,
      file: file || null, // Garante que 'file' seja null se não for fornecido
    });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    // Log detalhado do erro no console do servidor para depuração
    console.error("Erro ao criar post no fórum:", err.message); // Adicionado .message para mais detalhes

    // Verificação de erro de validação do Mongoose
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    // Para outros erros não previstos
    res.status(500).json({ error: 'Erro interno do servidor ao criar o post.' });
  }
});

// Listar posts (ordem descendente) - Esta deve vir antes de rotas com parâmetros genéricos se for '/'.
// No seu caso, '/forum' pode ser o path base no app.js, então esta é a rota raiz.
router.get('/', async (req, res) => {
  try {
    const posts = await ForumPost.find().sort({ createdAt: -1 }).populate('user', 'username');
    res.json(posts);
  } catch (err) {
    console.error("Erro ao buscar posts:", err.message); // Adicionado .message para mais detalhes
    res.status(500).json({ error: 'Erro ao buscar posts' });
  }
});

// Rota para buscar os posts mais votados
router.get('/top', async (req, res) => {
  try {
    const topPosts = await ForumPost.find()
      .sort({ votes: -1 })
      .limit(10)
      .populate('user', 'username');
    res.json(topPosts);
  } catch (err) {
    console.error("Erro ao buscar posts mais votados:", err.message);
    res.status(500).json({ error: 'Erro ao buscar posts mais votados' });
  }
});

// Rota para buscar um post específico pelo ID
router.get('/:id', async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id).populate('user', 'username');
    if (!post) {
      return res.status(404).json({ error: 'Post não encontrado.' });
    }
    res.json(post);
  } catch (err) {
    console.error("Erro ao buscar post por ID:", err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'ID de post inválido.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor ao buscar o post.' });
  }
});

// Votar (up/down)
router.post('/:id/vote', auth, async (req, res) => {
  const { type } = req.body;
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const prevVote = post.voters.get(req.userId);

    if (prevVote === type) return res.status(400).json({ error: 'Você já votou assim' });

    if (prevVote === 'up') post.votes--;
    if (prevVote === 'down') post.votes++;

    if (type === 'up') post.votes++;
    if (type === 'down') post.votes--;

    post.voters.set(req.userId, type);
    await post.save();

    res.json({ votes: post.votes });
  } catch (err) {
    console.error("Erro ao votar no post:", err.message);
    res.status(500).json({ error: 'Erro ao votar' });
  }
});

// Adicionar comentário
router.post('/:id/comments', auth, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Não autorizado. Faça login para comentar.' });
    }

    const newComment = new Comment({
      postId: req.params.id,
      user: req.userId,
      content: req.body.content
    });
    await newComment.save();
    res.status(201).json(newComment);
  } catch (err) {
    console.error("Erro ao adicionar comentário:", err.message);
    res.status(500).json({ error: 'Erro ao comentar' });
  }
});

// Listar comentários de post
router.get('/:id/comments', async (req, res) => {
  try {
    const all = req.query.all === 'true';
    let query = Comment.find({ postId: req.params.id });

    if (!all) {
      query = query.sort({ createdAt: -1 }).limit(3);
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const comments = await query.populate('user', 'username');
    res.json(comments);
  } catch (err) {
    console.error("Erro ao buscar comentários:", err.message);
    res.status(500).json({ error: 'Erro ao buscar comentários' });
  }
});

// NOVO: Rota para ranking dos 5 perfis com mais interações
router.get('/ranking/users', async (req, res) => {
  try {
    // Agregação para contar posts por usuário
    const postsByUser = await ForumPost.aggregate([
      { $group: { _id: "$user", postCount: { $sum: 1 } } }
    ]);

    // Agregação para contar comentários por usuário
    const commentsByUser = await Comment.aggregate([
      { $group: { _id: "$user", commentCount: { $sum: 1 } } }
    ]);

    // Mapear contagens de posts e comentários para um objeto fácil de acessar
    const userInteractions = new Map();

    postsByUser.forEach(item => {
      userInteractions.set(item._id.toString(), {
        postCount: item.postCount,
        commentCount: 0,
        totalInteractions: item.postCount
      });
    });

    commentsByUser.forEach(item => {
      const userId = item._id.toString();
      if (userInteractions.has(userId)) {
        const existing = userInteractions.get(userId);
        existing.commentCount = item.commentCount;
        existing.totalInteractions += item.commentCount;
      } else {
        userInteractions.set(userId, {
          postCount: 0,
          commentCount: item.commentCount,
          totalInteractions: item.commentCount
        });
      }
    });

    // Converter para array e popular usernames
    let rankedUsers = Array.from(userInteractions.entries()).map(([userId, data]) => ({
      _id: userId,
      totalInteractions: data.totalInteractions
    }));

    // Ordenar pelo total de interações e limitar aos 5 primeiros
    rankedUsers.sort((a, b) => b.totalInteractions - a.totalInteractions);
    rankedUsers = rankedUsers.slice(0, 5);

    // Popular usernames
    const userIds = rankedUsers.map(u => u._id);
    const usersData = await User.find({ _id: { $in: userIds } }, 'username');
    const usernameMap = new Map(usersData.map(user => [user._id.toString(), user.username]));

    const finalRankedUsers = rankedUsers.map(user => ({
      ...user,
      username: usernameMap.get(user._id) || 'Usuário Desconhecido' // Fallback
    }));

    res.json(finalRankedUsers);

  } catch (err) {
    console.error("Erro ao buscar ranking de usuários:", err.message);
    res.status(500).json({ error: 'Erro ao buscar ranking de usuários' });
  }
});

// NOVO: Rota para ranking das 5 categorias mais movimentadas
router.get('/ranking/categories', async (req, res) => {
  try {
    const topCategories = await ForumPost.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } }, // Agrupa por tipo e conta posts
      { $sort: { count: -1 } }, // Ordena por contagem descendente
      { $limit: 5 } // Limita aos 5 primeiros
    ]);

    // Formata o resultado para ter 'name' em vez de '_id'
    const formattedCategories = topCategories.map(cat => ({
      name: cat._id,
      count: cat.count
    }));

    res.json(formattedCategories);
  } catch (err) {
    console.error("Erro ao buscar ranking de categorias:", err.message);
    res.status(500).json({ error: 'Erro ao buscar ranking de categorias' });
  }
});

module.exports = router;
