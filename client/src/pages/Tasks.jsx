// client/src/pages/Tasks.jsx
import React, { useEffect, useState } from 'react';
import API from '../api';
import { format } from 'date-fns';

/**
 * Tasks component
 * Props:
 *  - noteId (required) : number
 *  - editable (optional) : boolean (default true) — if false, UI is read-only
 */
export default function Tasks({ noteId, editable = true }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!noteId) {
      setTasks([]);
      return;
    }
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function fetchTasks() {
    if (!noteId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data } = await API.get(`/tasks/note/${noteId}`);
      setTasks(data || []);
    } catch (err) {
      console.error('fetchTasks error', err);
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  async function createTask() {
    if (!editable) {
      alert('You do not have permission to create tasks for this note.');
      return;
    }
    if (!title || title.trim() === '') {
      alert('Please enter a task title.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await API.post('/tasks', { note_id: noteId, title: title.trim(), due_date: due || null });
      setTitle('');
      setDue('');
      await fetchTasks();
    } catch (err) {
      console.error('createTask error', err);
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDone(t) {
    if (!editable) {
      alert('You do not have permission to modify tasks for this note.');
      return;
    }
    try {
      await API.put(`/tasks/${t.id}`, { done: !t.done });
      await fetchTasks();
    } catch (err) {
      console.error('toggleDone error', err);
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to update task');
    }
  }

  async function removeTask(t) {
    if (!editable) {
      alert('You do not have permission to delete tasks for this note.');
      return;
    }
    if (!confirm('Delete this task?')) return;
    try {
      await API.delete(`/tasks/${t.id}`);
      await fetchTasks();
    } catch (err) {
      console.error('removeTask error', err);
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to delete task');
    }
  }

  return (
    <div style={{ border: '1px solid #eef2f6', padding: 12, borderRadius: 10, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>Tasks</h4>
        {!editable && <div style={{ fontSize: 12, color: '#6b7280' }}>Read only</div>}
      </div>

      {errorMsg && <div style={{ color: 'crimson', marginBottom: 8 }}>{errorMsg}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          className="input"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!editable || loading}
          style={{ flex: 1 }}
        />
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          disabled={!editable || loading}
          style={{ width: 200 }}
        />
        <button
          className="button"
          onClick={createTask}
          disabled={!editable || loading || !noteId}
          title={noteId ? (editable ? 'Add task' : 'Read-only') : 'Select or save a note first'}
        >
          Add
        </button>
      </div>

      <div>
        {loading && <div style={{ color: '#6b7280' }}>Loading tasks…</div>}
        {!loading && tasks.length === 0 && <div style={{ color: '#6b7280' }}>No tasks</div>}
        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderBottom: '1px solid #f3f5f7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} disabled={!editable} />
                <div>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {t.due_date ? `Due ${format(new Date(t.due_date), 'yyyy-MM-dd HH:mm')}` : 'No due date'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => removeTask(t)} disabled={!editable} className="small" style={{ background: 'transparent', border: '1px solid #e6e9ee', borderRadius: 6 }}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
