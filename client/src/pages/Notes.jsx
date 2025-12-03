import React, {useEffect, useState} from 'react'
import API, { setAuth } from '../api'
import NoteEditor from './NoteEditor'

export default function Notes(){
  const [notes,setNotes] = useState([])
  const [selected, setSelected] = useState(null)
  const token = localStorage.getItem('tn_token')

  useEffect(()=>{ if(token) setAuth(token); fetchNotes() }, [])

  async function fetchNotes(){
    try{ const { data } = await API.get('/notes'); setNotes(data) }catch(e){ console.error('fetchNotes', e) }
  }

  async function openNote(n){
    try{
      const { data } = await API.get(`/notes/${n.id}`);
      setSelected(data);
    }catch(err){
      const msg = err?.response?.data?.error || err.message
      alert('Cannot open note: ' + msg)
    }
  }

  return (
    <div className="app-shell">
      <div className="header">
        <div><a href="/">TeamNotes</a></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{color:'#6b7280', fontSize:13}}>Collaborative notes & tasks</div>
        </div>
      </div>

      <div className="layout">
        <div className="notes-list">
          <h4 style={{marginTop:0}}>Notes</h4>
          {notes.map(n=>(
            <div key={n.id} className="note-item" onClick={()=>openNote(n)}>
              <div>
                <div className="title">{n.title || '(untitled)'}</div>
                <div className="meta">{new Date(n.updated_at).toLocaleString()}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:12, color:'#637381'}}>{n.owner_id === JSON.parse(localStorage.getItem('tn_user')||'{}').id ? 'Owner' : 'Shared'}</div>
              </div>
            </div>
          ))}
          {notes.length===0 && <div style={{color:'#7b8794'}}>No notes yet — create one in the editor</div>}
        </div>

        <div>
          <div className="editor">
            <NoteEditor note={selected} onSaved={() => { fetchNotes(); setSelected(null); }} />
          </div>
        </div>
      </div>
    </div>
  )
}
