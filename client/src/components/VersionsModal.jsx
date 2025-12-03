import React, { useState, useEffect } from 'react';
import API from '../api';

export default function VersionsModal({ noteId, onClose, onReverted }) {
  const [versions, setVersions] = useState([]);

  useEffect(()=>{ if(noteId) fetchVersions(); }, [noteId]);

  async function fetchVersions(){
    try{
      const { data } = await API.get(`/notes/${noteId}/versions`);
      setVersions(data);
    }catch(err){ console.error(err); setVersions([]); }
  }

  async function revert(versionId){
    if(!confirm('Revert to this version? This creates a new version entry.')) return;
    try{
      await API.post(`/notes/${noteId}/versions/${versionId}/revert`);
      onReverted && onReverted();
      fetchVersions();
      alert('Reverted');
    }catch(e){ alert('Revert failed: ' + (e?.response?.data?.error || e.message)) }
  }

  return (
    <div style={{border:'1px solid #ddd', padding:12, background:'#fff'}}>
      <h4>Versions</h4>
      <button onClick={onClose}>Close</button>
      <ul>
        {versions.map(v=>(
          <li key={v.id} style={{marginBottom:8}}>
            <div><strong>{v.title || 'Untitled'}</strong> — {new Date(v.versioned_at).toLocaleString()} — editor: {v.editor_id}</div>
            <div style={{whiteSpace:'pre-wrap'}}>{v.content.slice(0,300)}{v.content.length>300 ? '...' : ''}</div>
            <div><button onClick={()=>revert(v.id)}>Revert to this</button></div>
          </li>
        ))}
        {versions.length===0 && <li>No versions</li>}
      </ul>
    </div>
  );
}
