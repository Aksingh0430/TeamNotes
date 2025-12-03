import React, {useState} from 'react'
import API, { setAuth } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Signup(){
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [name,setName] = useState('')
  const nav = useNavigate()
  const submit = async e=>{
    e.preventDefault()
    try{
      const { data } = await API.post('/auth/signup',{ email, password, name })
      localStorage.setItem('tn_token', data.token)
      localStorage.setItem('tn_user', JSON.stringify(data.user))
      setAuth(data.token)
      nav('/')
    }catch(err){ alert(err?.response?.data?.error || 'Signup failed') }
  }
  return (
    <form onSubmit={submit} style={{maxWidth:420, margin:'20px auto'}}>
      <h2>Signup</h2>
      <div><input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} /></div>
      <div><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
      <div><input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
      <button type="submit">Create account</button>
    </form>
  )
}
