import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, useProgress, Html } from '@react-three/drei';
import { Controls } from './components/Controls';
import { CirculatorySystem } from './components/CirculatorySystem';
import { SimulationSettings } from './types';

// 3D 场景内的加载指示器
const Loader = () => {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center">
        {/* 心跳动画 */}
        <div className="relative w-20 h-20 mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full animate-pulse">
            <path
              d="M50 88 C20 60, 10 40, 25 25 C35 15, 50 20, 50 35 C50 20, 65 15, 75 25 C90 40, 80 60, 50 88"
              fill="#ef4444"
              className="drop-shadow-lg"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        <p className="text-white text-lg font-semibold mb-2">Loading 3D Model...</p>
        <p className="text-slate-400 text-sm">{progress.toFixed(0)}% complete</p>
        <p className="text-slate-500 text-xs mt-2">Initializing circulatory system</p>
      </div>
    </Html>
  );
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<SimulationSettings>({
    heartRate: 72,
    flowSpeed: 1.0,
    respirationRate: 16,
    showVessels: true,
  });

  return (
    <div className="relative w-full h-screen bg-slate-900">
      {/* Header/Title Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-500 drop-shadow-sm">
          Circulatory 3D
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-md">
          Interactive schematic of human blood circulation. <br/>
          Observe the transition from <span className="text-blue-400">Oxygen-Poor</span> to <span className="text-red-400">Oxygen-Rich</span> blood.
        </p>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 18], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0f172a']} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#fff0f0" />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#b0c4de" />
        
        {/* Scene Environment */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="city" />

        <Suspense fallback={<Loader />}>
          <CirculatorySystem settings={settings} />
        </Suspense>

        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 4}
          minDistance={8}
          maxDistance={35}
        />
      </Canvas>

      {/* UI Controls */}
      <Controls settings={settings} setSettings={setSettings} />
      
      {/* Footer Disclaimer */}
      <div className="absolute bottom-4 left-0 w-full text-center text-xs text-slate-600 pointer-events-none">
        Schematic Visualization • Not for Medical Diagnosis
      </div>
    </div>
  );
};

export default App;