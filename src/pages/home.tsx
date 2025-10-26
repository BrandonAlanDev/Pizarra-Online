import { useState } from 'react'
import reactLogo from '../assets/react.svg'
import viteLogo from '/vite.svg'
import Pizarra from '../components/Pizarra'
import '../App.css'

function Home() {
  const [count, setCount] = useState(0)

  return (
        <div className="flex flex-col justify-center items-center bg-linear-60 from-white to-[#bebfff] w-[100vw] h-[100vh] text-black">
            <h1 className='font-bold font-mono'>Pizarra Online</h1>
            <div className='flex flex-col justify-center items-center'>
            <Pizarra width={900} height={600} />
            </div>
        </div>
  )
}

export default Home