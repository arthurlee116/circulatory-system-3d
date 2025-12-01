import React from 'react';
import { SimulationSettings } from '../types';

interface ControlsProps {
  settings: SimulationSettings;
  setSettings: React.Dispatch<React.SetStateAction<SimulationSettings>>;
}

export const Controls: React.FC<ControlsProps> = ({ settings, setSettings }) => {
  const handleChange = (key: keyof SimulationSettings, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md p-6 rounded-xl border border-slate-700 shadow-2xl w-80 text-slate-200 select-none">
      <h2 className="text-xl font-bold mb-4 text-blue-400 border-b border-slate-700 pb-2">System Controls</h2>
      
      {/* Heart Rate */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <label className="text-sm font-medium">Heart Rate</label>
          <span className="text-sm font-mono text-blue-300">{settings.heartRate} BPM</span>
        </div>
        <input
          type="range"
          min="30"
          max="180"
          value={settings.heartRate}
          onChange={(e) => handleChange('heartRate', parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Bradycardia</span>
          <span>Tachycardia</span>
        </div>
      </div>

      {/* Respiration Rate */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <label className="text-sm font-medium">Respiration Rate</label>
          <span className="text-sm font-mono text-green-300">{settings.respirationRate} /min</span>
        </div>
        <input
          type="range"
          min="5"
          max="40"
          value={settings.respirationRate}
          onChange={(e) => handleChange('respirationRate', parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
      </div>

      {/* Flow Speed */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <label className="text-sm font-medium">Circulation Speed</label>
          <span className="text-sm font-mono text-purple-300">{settings.flowSpeed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="3.0"
          step="0.1"
          value={settings.flowSpeed}
          onChange={(e) => handleChange('flowSpeed', parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>

      {/* Toggles */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Show Vessel Paths</label>
        <button
          onClick={() => handleChange('showVessels', !settings.showVessels)}
          className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out flex items-center px-1 ${settings.showVessels ? 'bg-blue-600' : 'bg-slate-600'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${settings.showVessels ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700 text-xs text-slate-400 leading-relaxed">
        <p>
          <strong className="text-blue-400">Blue:</strong> Oxygen-poor blood (Veins)<br/>
          <strong className="text-red-400">Red:</strong> Oxygen-rich blood (Arteries)
        </p>
      </div>
    </div>
  );
};