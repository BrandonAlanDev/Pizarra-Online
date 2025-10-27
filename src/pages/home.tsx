import Pizarra from '../components/Pizarra'
import '../App.css'

function Home() {

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