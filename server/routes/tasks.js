// server/routes/tasks.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Create task
router.post('/', auth, async (req, res) => {
  const { note_id, title, description, due_date } = req.body;
  const uid = req.user.id;
  try {
    const result = await db.query(
      `INSERT INTO tasks (note_id, title, description, due_date) VALUES ($1,$2,$3,$4) RETURNING *`,
      [note_id, title, description, due_date || null]
    );
    const task = result.rows[0];
    await db.query('INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)', [uid, note_id, 'create_task', JSON.stringify({ title, task_id: task.id })]);
    res.json(task);
  } catch (err) {
    console.error('create task error', err);
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

// Update task (title/description/due_date/done)
router.put('/:id', auth, async (req, res) => {
  const id = req.params.id;
  const { title, description, due_date, done } = req.body;
  const uid = req.user.id;
  try {
    const result = await db.query(
      `UPDATE tasks SET title=$1, description=$2, due_date=$3, done=COALESCE($4, done) WHERE id=$5 RETURNING *`,
      [title, description, due_date || null, typeof done === 'boolean' ? done : null, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
    const t = result.rows[0];
    await db.query('INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)', [uid, t.note_id, 'update_task', JSON.stringify({ task_id: id })]);
    res.json(t);
  } catch (err) {
    console.error('update task error', err);
    res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  const id = req.params.id;
  const uid = req.user.id;
  try {
    const { rows } = await db.query('SELECT note_id FROM tasks WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    const note_id = rows[0].note_id;
    await db.query('DELETE FROM tasks WHERE id=$1', [id]);
    await db.query('INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)', [uid, note_id, 'delete_task', JSON.stringify({ task_id: id })]);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete task error', err);
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
  }
});

// List tasks for a note
router.get('/note/:note_id', auth, async (req, res) => {
  const note_id = req.params.note_id;
  try {
    const { rows } = await db.query('SELECT * FROM tasks WHERE note_id=$1 ORDER BY done ASC, due_date IS NULL, due_date ASC, created_at DESC', [note_id]);
    res.json(rows);
  } catch (err) {
    console.error('list tasks error', err);
    res.status(500).json({ error: 'Failed to list tasks', details: err.message });
  }
});

// List tasks due soon for the current user across their notes (next N days)
router.get('/due/upcoming', auth, async (req, res) => {
  const uid = req.user.id;
  // by default next 7 days; client can pass ?days=3
  const days = parseInt(req.query.days || '7', 10);
  try {
    const { rows } = await db.query(
      `SELECT t.* FROM tasks t
       JOIN notes n ON t.note_id = n.id
       LEFT JOIN note_shares s ON n.id = s.note_id
       WHERE (n.owner_id=$1 OR s.user_id=$1) AND t.done = false AND t.due_date IS NOT NULL AND t.due_date <= now() + ($2 || ' days')::interval
       ORDER BY t.due_date ASC`,
      [uid, days]
    );
    res.json(rows);
  } catch (err) {
    console.error('upcoming tasks error', err);
    res.status(500).json({ error: 'Failed to get upcoming tasks', details: err.message });
  }
});

module.exports = router;
