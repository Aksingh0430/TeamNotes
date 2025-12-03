import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './components/Header'

export default function App(){
  return (
    <div>
      <Header />
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
