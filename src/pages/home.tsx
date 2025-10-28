import Pizarra from '../components/Pizarra'
import '../App.css'

function Home() {

  return (
        <div className="flex flex-col justify-center items-center bg-linear-60 from-white to-[#bebfff] w-[100vw] h-[100vh] text-black">
            <div className='flex flex-col justify-center items-center'>
            <Pizarra/>
            </div>
        </div>
  )
}

export default Home