import React, { useRef, useEffect, useState, useCallback } from 'react';

type BrushStyle = 'solid' | 'dashed' | 'marker' | 'spray';

interface PizarraProps {
  width: number;
  height: number;
}

const Pizarra: React.FC<PizarraProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // --- NUEVO: Ref para el input de archivo oculto ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dibujando, setDibujando] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [grosor, setGrosor] = useState(5);
  const [historial, setHistorial] = useState<ImageData[]>([]);
  const [indiceHistorial, setIndiceHistorial] = useState(-1);
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('solid');

  const obtenerContexto = (): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext('2d') ?? null;
  };

  const guardarEstado = useCallback(() => {
    const context = obtenerContexto();
    const canvas = canvasRef.current;
    if (context && canvas) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const nuevoHistorial = historial.slice(0, indiceHistorial + 1);
      setHistorial([...nuevoHistorial, imageData]);
      setIndiceHistorial(nuevoHistorial.length);
    }
  }, [historial, indiceHistorial]);
  
  // Inicializa el historial con un canvas en blanco
  useEffect(() => {
    const context = obtenerContexto();
    const canvas = canvasRef.current;
    if (context && canvas && historial.length === 0) {
      const estadoInicial = context.getImageData(0, 0, canvas.width, canvas.height);
      setHistorial([estadoInicial]);
      setIndiceHistorial(0);
    }
  }, []);

  // Configura las propiedades del pincel
  useEffect(() => {
    const context = obtenerContexto();
    if (context) {
      context.lineCap = 'round';
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = grosor;
      context.globalAlpha = 1;
      context.setLineDash([]);
      switch (brushStyle) {
        case 'dashed': context.setLineDash([15, 15]); break;
        case 'marker': context.globalAlpha = 0.3; break;
      }
    }
  }, [color, grosor, brushStyle]);
  
  // --- NUEVO: Función unificada para dibujar una imagen en el canvas ---
  const drawImageOnCanvas = useCallback((imageFile: File) => {
    const canvas = canvasRef.current;
    const context = obtenerContexto();
    if (!context || !canvas) return;

    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      // Escala la imagen para que quepa en el canvas y la centra
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;
      context.drawImage(img, x, y, img.width * scale, img.height * scale);
      URL.revokeObjectURL(url);
      // Guarda el estado después de dibujar la imagen
      guardarEstado();
    };
    img.src = url;
  }, [guardarEstado]);


  // --- NUEVO: useEffect para el evento de pegado (Ctrl+V) ---
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            drawImageOnCanvas(file);
          }
          break; // Procesamos solo la primera imagen encontrada
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [drawImageOnCanvas]);

  // Manejador para los atajos de teclado (Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey)) {
        if (event.key === 'z') { event.preventDefault(); deshacer(); }
        if (event.key === 'y') { event.preventDefault(); rehacer(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [indiceHistorial, historial]); // Dependencias correctas

  const iniciarDibujo = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.buttons !== 1) return;
    const context = obtenerContexto();
    if (context) {
      setDibujando(true);
      const { offsetX, offsetY } = event.nativeEvent;
      context.beginPath();
      context.moveTo(offsetX, offsetY);
      if (brushStyle === 'spray') dibujar(event);
    }
  };

  const dibujar = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dibujando) return;
    const context = obtenerContexto();
    if (!context) return;
    const { offsetX, offsetY } = event.nativeEvent;
    switch (brushStyle) {
      case 'spray':
        const sprayRadius = grosor;
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * 2 * Math.PI;
          const radius = Math.random() * sprayRadius;
          const x = offsetX + radius * Math.cos(angle);
          const y = offsetY + radius * Math.sin(angle);
          context.fillRect(x, y, 1, 1);
        }
        break;
      default:
        context.lineTo(offsetX, offsetY);
        context.stroke();
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
    const estadoAnterior = historial[nuevoIndice];
    const context = obtenerContexto();
    if (context && estadoAnterior) {
      context.putImageData(estadoAnterior, 0, 0);
      setIndiceHistorial(nuevoIndice);
    }
  };

  const rehacer = () => {
    if (indiceHistorial >= historial.length - 1) return;
    const nuevoIndice = indiceHistorial + 1;
    const estadoSiguiente = historial[nuevoIndice];
    const context = obtenerContexto();
    if (context && estadoSiguiente) {
      context.putImageData(estadoSiguiente, 0, 0);
      setIndiceHistorial(nuevoIndice);
    }
  };

  const activarBorrador = () => { /* ... */ };
  const activarPincel = () => { /* ... */ };

  // --- NUEVO: Handlers para el botón de subir archivo ---
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      drawImageOnCanvas(file);
    }
    // Limpiamos el valor para poder subir el mismo archivo otra vez
    event.target.value = '';
  };


  return (
    <div className='p-12 rounded-3xl bg-white'>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={iniciarDibujo}
        onMouseMove={dibujar}
        onMouseUp={finalizarDibujo}
        onMouseLeave={finalizarDibujo}
        className='bg-green-600 m-auto border-2 rounded-2xl border-amber-400'
      />
      <div className='mt-2'>
        {/* Controles existentes */}
        <label htmlFor="color">Color:</label>
        <input type="color" id="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <label htmlFor="grosor">Grosor:</label>
        <input type="range" id="grosor" min="1" max="50" value={grosor} onChange={(e) => setGrosor(parseInt(e.target.value))} />
        <label htmlFor="brush-style">Estilo:</label>
        <select id="brush-style" value={brushStyle} onChange={(e) => setBrushStyle(e.target.value as BrushStyle)}>
          <option value="solid">Sólido</option>
          <option value="dashed">Trazos</option>
          <option value="marker">Marcador</option>
          <option value="spray">Aerosol</option>
        </select>
        {/* --- TODO: Remplazar por iconos los elementos --- */}
        <button onClick={activarPincel}>Pincel</button>
        <button onClick={activarBorrador}>Goma</button>
        <button onClick={deshacer} disabled={indiceHistorial <= 0}>Deshacer</button>
        <button onClick={rehacer} disabled={indiceHistorial >= historial.length - 1}>Rehacer</button>
        {/* --- NUEVO: Elementos para subir imagen --- */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept="image/*"
        />
        <button onClick={handleUploadClick}>Subir Imagen</button>
      </div>
    </div>
  );
};

export default Pizarra;