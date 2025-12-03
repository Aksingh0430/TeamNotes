const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const uid = req.user.id;
  try {
    const { rows } = await db.query(
      `SELECT a.*, u.name as actor_name FROM activity_log a LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN notes n ON a.note_id = n.id
       LEFT JOIN note_shares s ON n.id = s.note_id
       WHERE a.user_id=$1 OR n.owner_id=$1 OR s.user_id=$1
       ORDER BY a.created_at DESC LIMIT 200`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load activity', details: err.message });
  }
});

module.exports = router;
