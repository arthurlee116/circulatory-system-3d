import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import { Controls } from './components/Controls';
import { CirculatorySystem } from './components/CirculatorySystem';
import { SimulationSettings } from './types';

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

        <Suspense fallback={null}>
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