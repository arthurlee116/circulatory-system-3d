import { ThreeElements } from '@react-three/fiber';

export interface SimulationSettings {
  heartRate: number; // BPM
  flowSpeed: number; // Multiplier
  respirationRate: number; // Breaths per minute
  showVessels: boolean;
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}