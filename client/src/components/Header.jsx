import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Header(){
  const navigate = useNavigate()
  const logout = ()=>{ localStorage.removeItem('tn_token'); localStorage.removeItem('tn_user'); navigate('/login') }
  const user = JSON.parse(localStorage.getItem('tn_user')||'null')
  return (
    <header style={{display:'flex',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid #eee'}}>
      <div><Link to="/">TeamNotes</Link></div>
      <div>
        {user ? (
          <>
            <span style={{marginRight:12}}>Hi {user.name||user.email}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link> | <Link to="/signup">Signup</Link>
          </>
        )}
      </div>
    </header>
  )
}
