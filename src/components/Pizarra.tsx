import React, { useRef, useEffect, useState, useCallback } from 'react';

type BrushStyle = 'solid' | 'dashed' | 'marker' | 'spray';

// Las props de tamaño ya no son necesarias, el componente es autónomo.
interface PizarraProps {}

const Pizarra: React.FC<PizarraProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref para el div contenedor que mediremos
  const containerRef = useRef<HTMLDivElement>(null);

  // Estado para las dimensiones del canvas, se ajustarán dinámicamente
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const [dibujando, setDibujando] = useState(false);
  const [color, setColor] = useState('#000000'); // Color inicial negro
  const [grosor, setGrosor] = useState(5);
  const [historial, setHistorial] = useState<ImageData[]>([]);
  const [indiceHistorial, setIndiceHistorial] = useState(-1);
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('solid');

  const obtenerContexto = (): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  };

  const guardarEstado = useCallback(() => {
    const context = obtenerContexto();
    const canvas = canvasRef.current;
    if (context && canvas && canvas.width > 0 && canvas.height > 0) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const nuevoHistorial = historial.slice(0, indiceHistorial + 1);
      setHistorial([...nuevoHistorial, imageData]);
      setIndiceHistorial(nuevoHistorial.length);
    }
  }, [historial, indiceHistorial]);

  // Hook para ajustar el tamaño del canvas al de su contenedor
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth,
          height: clientHeight,
        });
      }
    };
    handleResize(); // Medir el tamaño inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hook para restaurar el dibujo cuando el canvas cambia de tamaño
  useEffect(() => {
    if (historial.length === 0 || dimensions.width === 0) return;
    
    const context = obtenerContexto();
    const ultimoEstado = historial[indiceHistorial];
    if (context && ultimoEstado) {
      createImageBitmap(ultimoEstado).then(imgBitmap => {
        context.drawImage(imgBitmap, 0, 0, dimensions.width, dimensions.height);
      });
    }
  }, [dimensions, indiceHistorial, historial]); // Se ejecuta si las dimensiones cambian

  // Guarda el estado inicial en blanco
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0 && historial.length === 0) {
        // Rellenar de color de fondo y guardar
        const context = obtenerContexto();
        if(context){
            context.fillStyle = '#00a63e';
            context.fillRect(0,0, canvas.width, canvas.height);
            guardarEstado();
        }
    }
  }, [dimensions, guardarEstado, historial.length]);

  // Aplica los estilos del pincel
  useEffect(() => {
    const context = obtenerContexto();
    if (context) {
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = grosor;
      context.globalAlpha = 1;
      context.setLineDash([]);
      switch (brushStyle) {
        case 'dashed': context.setLineDash([grosor * 2, grosor * 1.5]); break;
        case 'marker': context.globalAlpha = 0.3; break;
      }
    }
  }, [color, grosor, brushStyle, dimensions]); // 'dimensions' se añade para reaplicar estilos tras redimensionar
  
  const drawImageOnCanvas = useCallback((imageFile: File) => {
    const canvas = canvasRef.current;
    const context = obtenerContexto();
    if (!context || !canvas) return;
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;
      context.drawImage(img, x, y, img.width * scale, img.height * scale);
      URL.revokeObjectURL(url);
      guardarEstado();
    };
    img.src = url;
  }, [guardarEstado]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) drawImageOnCanvas(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [drawImageOnCanvas]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey)) {
        if (event.key === 'z') { event.preventDefault(); deshacer(); }
        if (event.key === 'y') { event.preventDefault(); rehacer(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historial, indiceHistorial]); // Dependencias correctas

  const obtenerCoordenadas = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event.nativeEvent ? event.nativeEvent.touches[0].clientX : event.nativeEvent.clientX;
    const clientY = 'touches' in event.nativeEvent ? event.nativeEvent.touches[0].clientY : event.nativeEvent.clientY;
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: canvasX * scaleX, y: canvasY * scaleY };
  };

  const aplicarSpray = (context: CanvasRenderingContext2D, x: number, y: number) => {
    const sprayRadius = grosor * 1.5;
    const density = grosor * 2;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.random() * sprayRadius;
      const sprayX = x + radius * Math.cos(angle);
      const sprayY = y + radius * Math.sin(angle);
      context.fillRect(sprayX, sprayY, 1, 1); 
    }
  }

  const iniciarDibujo = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (event.type === 'mousedown' && (event as React.MouseEvent).buttons !== 1) return;
    const context = obtenerContexto();
    if (context) {
      setDibujando(true);
      const { x, y } = obtenerCoordenadas(event);
      context.beginPath();
      context.moveTo(x, y);
      if (brushStyle === 'spray') aplicarSpray(context, x, y);
    }
  };

  const dibujar = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!dibujando) return;
    const context = obtenerContexto();
    if (!context) return;
    const { x, y } = obtenerCoordenadas(event);
    switch (brushStyle) {
      case 'spray': aplicarSpray(context, x, y); break;
      default:
        context.lineTo(x, y);
        context.stroke();
        if (brushStyle === 'dashed') {
             context.beginPath();
             context.moveTo(x, y);
        }
        break;
    }
  };

  const finalizarDibujo = () => {
    if (!dibujando) return;
    const context = obtenerContexto();
    if (context) {
      context.closePath();
      setDibujando(false);
      guardarEstado();
    }
  };

  const deshacer = () => {
    if (indiceHistorial <= 0) return;
    const nuevoIndice = indiceHistorial - 1;
    setIndiceHistorial(nuevoIndice); // Dispara el useEffect de restaurar
  };

  const rehacer = () => {
    if (indiceHistorial >= historial.length - 1) return;
    const nuevoIndice = indiceHistorial + 1;
    setIndiceHistorial(nuevoIndice); // Dispara el useEffect de restaurar
  };

  const activarBorrador = () => setColor('#00a63e');
  const activarPincel = () => setColor('#000000');
  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) drawImageOnCanvas(file);
    event.target.value = '';
  };

  return (
    <div className='lg:p-12 lg:rounded-3xl lg:bg-white w-[5000px] h-[5000px] max-w-screen max-h-screen flex flex-col overflow-hidden touch-none'>
        {/* El contenedor del canvas que se medirá */}
        <div ref={containerRef} className="w-[5000px] h-[5000px] max-w-full max-h-full flex-grow">
            <canvas
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              onMouseDown={iniciarDibujo}
              onMouseMove={dibujar}
              onMouseUp={finalizarDibujo}
              onMouseLeave={finalizarDibujo}
              onTouchStart={iniciarDibujo}
              onTouchMove={dibujar}
              onTouchEnd={finalizarDibujo}
              onTouchCancel={finalizarDibujo}
              style={{ touchAction: 'none' }}
              className={`bg-[#00a63e] m-auto lg:border-2 lg:rounded-2xl border-amber-400 max-w-full max-h-full cursor-crosshair`}
            />
        </div>
      
      {/* Controles */}
      <div className='flex-shrink-0 mt-2 flex flex-rw flex-wrap gap-2 p-2 bg-gray-100 rounded-lg justify-center fixed left-1 bottom-8'>
        <div className="flex flex-col">
            <label htmlFor="color" className="text-xs">Color</label>
            <input type="color" id="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8" />
        </div>
        <div className="flex flex-col w-24">
            <label htmlFor="grosor" className="text-xs">Grosor: {grosor}</label>
            <input type="range" id="grosor" min="1" max="50" value={grosor} onChange={(e) => setGrosor(parseInt(e.target.value))} />
        </div>
        <div className="flex flex-col">
             <label htmlFor="brush-style" className="text-xs">Estilo</label>
            <select id="brush-style" value={brushStyle} onChange={(e) => setBrushStyle(e.target.value as BrushStyle)} className="p-1 border rounded">
              <option value="solid">Sólido</option>
              <option value="dashed">Trazos</option>
              <option value="marker">Marcador</option>
              <option value="spray">Aerosol</option>
            </select>
        </div>
        <button onClick={activarPincel} className="px-1 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">P</button>
        <button onClick={activarBorrador} className="px-1 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm">G</button>
        <div className="flex gap-1">
            <button onClick={deshacer} disabled={indiceHistorial <= 0} className="px-1 py-1 bg-yellow-500 text-white rounded disabled:opacity-50 text-sm">←</button>
            <button onClick={rehacer} disabled={indiceHistorial >= historial.length - 1} className="px-1 py-1 bg-yellow-500 text-white rounded disabled:opacity-50 text-sm">→</button>
        </div>
        <button onClick={handleUploadClick} className="px-1 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm">Img</button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/*" />
    </div>
    </div>
  );
};

export default Pizarra;