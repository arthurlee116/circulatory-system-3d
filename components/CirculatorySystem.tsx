import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Vector3, Color, InstancedMesh, Object3D, Mesh, CanvasTexture, DoubleSide, CubicBezierCurve3 } from 'three';
import { SimulationSettings } from '../types';
import { Text, Float } from '@react-three/drei';

// --- Constants for Schematic Positions ---
const SCALE_FACTOR = 1.5; // Scale factor for spacing between organs (not geometry sizes)
const CENTER_Y = 1.0;

// Heart Layout - Keep relative positions unchanged (no scaling between chambers)
// Center roughly at (0, 1.0, 0)
const POS_RA = new Vector3(-0.6, 1.8, 0.0);   // Right Atrium (Upper Left from front)
const POS_LA = new Vector3(0.6, 1.8, -0.2);   // Left Atrium (Upper Right from front)
const POS_RV = new Vector3(-0.4, 0.6, 0.3);   // Right Ventricle (Lower Left)
const POS_LV = new Vector3(0.5, 0.5, 0.0);    // Left Ventricle (Lower Right, Apex)

// Organ/Bed Locations - Scaled for more spacing
const LUNG_L_POS = new Vector3(-5.5 * SCALE_FACTOR, 3.5 * SCALE_FACTOR, 0);
const LUNG_R_POS = new Vector3(5.5 * SCALE_FACTOR, 3.5 * SCALE_FACTOR, 0);
const BODY_UPPER_POS = new Vector3(0, 6.0 * SCALE_FACTOR, 0);
const BODY_LOWER_POS = new Vector3(0, -5.0 * SCALE_FACTOR, 0);

// Capillary Bed Offsets - Scaled
const BED_WIDTH_HALF = 1.2 * SCALE_FACTOR;
const BED_HEIGHT_HALF = 1.5 * SCALE_FACTOR;

// Colors
const COLOR_O2_RICH = new Color('#ef4444'); // Red
const COLOR_O2_POOR = new Color('#3b82f6'); // Blue

interface Props {
  settings: SimulationSettings;
}

// --- Helper: Gradient Texture for Capillaries ---
const getGradientTexture = (reverse: boolean = false) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 256, 0);
    const c1 = reverse ? '#3b82f6' : '#ef4444';
    const c2 = reverse ? '#ef4444' : '#3b82f6';
    
    gradient.addColorStop(0, c1);
    gradient.addColorStop(0.4, c1); 
    gradient.addColorStop(0.6, c2); 
    gradient.addColorStop(1, c2);
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 1);
  }
  return new CanvasTexture(canvas);
};

// --- Helper: Blood Particle System ---
const BloodFlow = ({ 
  path, 
  count, 
  speed, 
  radius = 0.1,
  type,
  overrideColor
}: { 
  path: CatmullRomCurve3 | CubicBezierCurve3; 
  count: number; 
  speed: number; 
  radius?: number;
  type?: 'systemic' | 'pulmonary' | 'internal' | 'capillary';
  overrideColor?: Color;
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  
  const particles = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      t: Math.random(), 
      offset: new Vector3(
        (Math.random() - 0.5) * (radius * 1.8), 
        (Math.random() - 0.5) * (radius * 1.8), 
        (Math.random() - 0.5) * (radius * 1.8)
      ),
      speedMod: 0.8 + Math.random() * 0.4 
    }));
  }, [count, radius]);

  useFrame((_, delta) => {
    if (!meshRef.current || !path) return;

    const moveSpeed = speed * delta * 0.15; 

    particles.forEach((particle, i) => {
      particle.t += moveSpeed * particle.speedMod;
      if (particle.t > 1) particle.t -= 1;

      const pos = path.getPointAt(particle.t);
      // SAFETY CHECK: prevent 'undefined' access if path is invalid or t is out of bounds
      if (pos) {
        dummy.position.copy(pos).add(particle.offset);
        
        let scale = 0.7;
        if (type === 'internal') scale = 0.5;
        if (type === 'capillary') scale = 0.35;
        
        // Adjust scale in capillary/lung areas
        if (type !== 'capillary' && particle.t > 0.4 && particle.t < 0.6) {
          scale = 0.4;
        }
        
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);

        let color = new Color();
        
        if (overrideColor) {
          color.copy(overrideColor);
        } else if (type === 'pulmonary') {
          // Blue -> Red
          if (particle.t < 0.5) {
             const alpha = Math.max(0, (particle.t - 0.3) * 5); 
             color.lerpColors(COLOR_O2_POOR, COLOR_O2_RICH, Math.min(1, alpha));
          } else {
             color.copy(COLOR_O2_RICH);
          }
        } else if (type === 'systemic') {
          // Red -> Blue
          if (particle.t < 0.5) {
             const alpha = Math.max(0, (particle.t - 0.3) * 5);
             color.lerpColors(COLOR_O2_RICH, COLOR_O2_POOR, Math.min(1, alpha));
          } else {
             color.copy(COLOR_O2_POOR);
          }
        } else if (type === 'capillary') {
          // Red -> Blue transition across capillary
          color.lerpColors(COLOR_O2_RICH, COLOR_O2_POOR, particle.t);
        }
        meshRef.current!.setColorAt(i, color);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
};

// --- Heart Chamber Component ---
const HeartChamber = ({ 
  position, 
  color, 
  label, 
  scale = [1, 1, 1], 
  rotation = [0, 0, 0],
  bpm, 
  phaseOffset = 0 
}: { 
  position: Vector3, 
  color: string, 
  label: string, 
  scale?: [number, number, number], 
  rotation?: [number, number, number],
  bpm: number, 
  phaseOffset?: number 
}) => {
  const meshRef = useRef<Mesh>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const beatFreq = bpm / 60;
      const time = clock.getElapsedTime();
      const beat = Math.pow(Math.sin((time * beatFreq + phaseOffset) * Math.PI * 2), 12);
      const pulse = 1 + beat * 0.1;
      meshRef.current.scale.set(scale[0] * pulse, scale[1] * pulse, scale[2] * pulse);
    }
  });

  return (
    <group position={position} rotation={[rotation[0], rotation[1], rotation[2]]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshPhysicalMaterial 
          color={color} 
          transparent 
          opacity={0.8} 
          roughness={0.2}
          metalness={0.1}
          transmission={0.2} // Less transparent to look like muscle
          thickness={1.5}
        />
      </mesh>
      <Text 
        position={[0, 0, 0.8]} 
        fontSize={0.195} 
        color="white" 
        anchorX="center" 
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
};

// --- Lung Component ---
const LungShape = ({ position, label, isLeft }: { position: Vector3, label: string, isLeft: boolean }) => {
  const meshRef = useRef<Mesh>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const breath = Math.sin(clock.getElapsedTime() * 0.8) * 0.05 + 1;
      meshRef.current.scale.set(1.4 * breath, 2.2 * breath, 1.2 * breath);
    }
  });

  return (
    <group position={position}>
       <mesh ref={meshRef} rotation={[0, 0, isLeft ? 0.2 : -0.2]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshPhysicalMaterial 
            color="#e0f2fe" 
            transparent 
            opacity={0.25} 
            roughness={0.4}
            transmission={0.5}
            thickness={2}
          />
       </mesh>
       <Text position={[0, 0, 1.5]} fontSize={0.325} color="#e2e8f0">{label}</Text>
    </group>
  );
};

// --- Capillary Bed Component ---
const CapillaryBed = ({ position, label, flowDirection = "systemic", flowSpeed = 1 }: { position: Vector3, label: string, flowDirection: "systemic" | "pulmonary", flowSpeed?: number }) => {
  const isSystemic = flowDirection === 'systemic';
  const gradientTexture = useMemo(() => getGradientTexture(!isSystemic), [isSystemic]);

  // Main vessel vertical tubes - Using 3 points to ensure CatmullRomCurve3 works reliably
  const leftVesselPath = useMemo(() => new CatmullRomCurve3([
    new Vector3(-BED_WIDTH_HALF, -BED_HEIGHT_HALF, 0),
    new Vector3(-BED_WIDTH_HALF, 0, 0),
    new Vector3(-BED_WIDTH_HALF, BED_HEIGHT_HALF, 0)
  ]), []);

  const rightVesselPath = useMemo(() => new CatmullRomCurve3([
    new Vector3(BED_WIDTH_HALF, -BED_HEIGHT_HALF, 0),
    new Vector3(BED_WIDTH_HALF, 0, 0),
    new Vector3(BED_WIDTH_HALF, BED_HEIGHT_HALF, 0)
  ]), []);

  // Generate connecting "capillaries"
  const bridges = useMemo(() => {
    const curves = [];
    const count = 20;
    for(let i=0; i<count; i++) {
        const t = 0.05 + (i / (count-1)) * 0.9; 
        const start = leftVesselPath.getPointAt(t);
        const end = rightVesselPath.getPointAt(t);
        
        if (start && end) {
          const mid1 = new Vector3().lerpVectors(start, end, 0.33);
          mid1.y += (Math.random()-0.5) * 0.5;
          mid1.z += (Math.random()-0.5) * 0.8;

          const mid2 = new Vector3().lerpVectors(start, end, 0.66);
          mid2.y += (Math.random()-0.5) * 0.5;
          mid2.z += (Math.random()-0.5) * 0.8;

          curves.push(new CubicBezierCurve3(start, mid1, mid2, end));
        }
    }
    return curves;
  }, [leftVesselPath, rightVesselPath]);

  const leftColor = isSystemic ? COLOR_O2_RICH : COLOR_O2_POOR;
  const rightColor = isSystemic ? COLOR_O2_POOR : COLOR_O2_RICH;

  return (
    <group position={position}>
      <Text position={[0, 2.8, 0]} fontSize={0.325} color="#e2e8f0">{label}</Text>
      
      {/* Left Main Tube Mesh */}
      <mesh>
         <tubeGeometry args={[leftVesselPath, 8, 0.15, 8, false]} />
         <meshPhysicalMaterial color={leftColor} transparent opacity={0.6} roughness={0.3} />
      </mesh>

      {/* Right Main Tube Mesh */}
      <mesh>
         <tubeGeometry args={[rightVesselPath, 8, 0.15, 8, false]} />
         <meshPhysicalMaterial color={rightColor} transparent opacity={0.6} roughness={0.3} />
      </mesh>

      {/* Connecting Capillaries */}
      {bridges.map((curve, i) => (
        <mesh key={i}>
          <tubeGeometry args={[curve, 8, 0.03, 4, false]} />
          <meshBasicMaterial map={gradientTexture} transparent opacity={0.5} />
        </mesh>
      ))}
      
      {/* Blood flow through capillary bridges */}
      {bridges.map((curve, i) => (
        <BloodFlow 
          key={`flow-${i}`}
          path={curve} 
          count={3} 
          speed={flowSpeed * 0.6} 
          radius={0.04}
          type="capillary"
          overrideColor={undefined}
        />
      ))}
    </group>
  );
};

// --- Microvessel Group Component (Arterioles/Venules) ---
const MicrovesselGroup = ({ 
  paths, 
  color, 
  label, 
  flowSpeed,
  labelPos = 0.5
}: { 
  paths: CatmullRomCurve3[]; 
  color: string; 
  label: string;
  flowSpeed: number;
  labelPos?: number;
}) => {
  const labelPosition = useMemo(() => {
    if (!paths || paths.length === 0) return null;
    // Use middle path for label position
    const middlePath = paths[Math.floor(paths.length / 2)];
    return middlePath.getPointAt(labelPos);
  }, [paths, labelPos]);

  return (
    <group>
      {paths.map((path, i) => (
        <React.Fragment key={i}>
          <mesh>
            <tubeGeometry args={[path, 32, 0.05, 8, false]} />
            <meshPhysicalMaterial 
              color={color} 
              transparent 
              opacity={0.4} 
              roughness={0.3} 
              transmission={0.4} 
              thickness={0.3} 
              depthWrite={false}
              side={DoubleSide} 
            />
          </mesh>
          <BloodFlow 
            path={path} 
            count={8} 
            speed={flowSpeed} 
            radius={0.05}
            overrideColor={new Color(color === '#fca5a5' ? '#ef4444' : '#3b82f6')}
          />
        </React.Fragment>
      ))}
      {label && labelPosition && (
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.1}>
          <Text 
            position={[labelPosition.x, labelPosition.y, labelPosition.z + 0.4]} 
            fontSize={0.22} 
            color="#cbd5e1" 
            anchorX="center" 
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#0f172a"
          >
            {label}
          </Text>
        </Float>
      )}
    </group>
  );
};

// --- Glassy Vessel Tube ---
const VesselTube = ({ path, radius = 0.12, label, labelPos = 0.5, labelOffset = 0.3, color="#ffffff" }: any) => {
  const labelPosition = useMemo(() => {
    if (!path) return null;
    return path.getPointAt(labelPos);
  }, [path, labelPos]);
  
  if (!path) return null;

  return (
    <group>
      <mesh>
        <tubeGeometry args={[path, 64, radius, 16, false]} />
        <meshPhysicalMaterial 
          color={color} 
          transparent 
          opacity={0.3} 
          roughness={0.2} 
          transmission={0.6} 
          thickness={0.5} 
          depthWrite={false}
          side={DoubleSide} 
        />
      </mesh>
      {label && labelPosition && (
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.1}>
          <Text 
            position={[labelPosition.x, labelPosition.y, labelPosition.z + labelOffset]} 
            fontSize={0.234} 
            color="#cbd5e1" 
            anchorX="center" 
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#0f172a"
          >
            {label}
          </Text>
        </Float>
      )}
    </group>
  );
};

export const CirculatorySystem: React.FC<Props> = ({ settings }) => {
  
  const { paths, visualPaths } = useMemo(() => {
    // --- Internal Heart Paths ---
    const pathRAtoRV = new CatmullRomCurve3([POS_RA, POS_RV], false);
    const pathLAtoLV = new CatmullRomCurve3([POS_LA, POS_LV], false);

    // --- Pulmonary Loop ---
    // Pulmonary Trunk exits RV (Top center of RV)
    const pulmoTrunkStart = new Vector3(POS_RV.x, POS_RV.y + 0.8, POS_RV.z);
    
    // Pulmonary Arteries: RV -> Lungs (Blue, deoxygenated, front path z+)
    // Left Pulmonary Artery: RV -> Trunk -> Left Lung
    const pulmonaryArteryLeft = new CatmullRomCurve3([
      POS_RV,
      pulmoTrunkStart,
      new Vector3(-1.5 * SCALE_FACTOR, 2.5 * SCALE_FACTOR, 0.4), // Arc out (front, z+)
      new Vector3(-3.5 * SCALE_FACTOR, 3.2 * SCALE_FACTOR, 0.3),
      LUNG_L_POS
    ]);

    // Right Pulmonary Artery: RV -> Trunk -> Right Lung
    const pulmonaryArteryRight = new CatmullRomCurve3([
      POS_RV,
      pulmoTrunkStart,
      new Vector3(1.5 * SCALE_FACTOR, 2.5 * SCALE_FACTOR, 0.4), // Arc out (front, z+)
      new Vector3(3.5 * SCALE_FACTOR, 3.2 * SCALE_FACTOR, 0.3),
      LUNG_R_POS
    ]);

    // Pulmonary Veins: Lungs -> LA (Red, oxygenated, back path z-)
    // Left lung positions for superior and inferior veins
    const lungLSupPos = new Vector3(LUNG_L_POS.x + 0.5, LUNG_L_POS.y + 0.8 * SCALE_FACTOR, LUNG_L_POS.z - 0.3);
    const lungLInfPos = new Vector3(LUNG_L_POS.x + 0.5, LUNG_L_POS.y - 0.8 * SCALE_FACTOR, LUNG_L_POS.z - 0.3);
    // Right lung positions for superior and inferior veins
    const lungRSupPos = new Vector3(LUNG_R_POS.x - 0.5, LUNG_R_POS.y + 0.8 * SCALE_FACTOR, LUNG_R_POS.z - 0.3);
    const lungRInfPos = new Vector3(LUNG_R_POS.x - 0.5, LUNG_R_POS.y - 0.8 * SCALE_FACTOR, LUNG_R_POS.z - 0.3);
    // LA posterior entry point
    const laPostEntry = new Vector3(POS_LA.x, POS_LA.y, POS_LA.z - 0.5);

    // Left Superior Pulmonary Vein
    const pulmonaryVeinLeftSup = new CatmullRomCurve3([
      lungLSupPos,
      new Vector3(-2.5 * SCALE_FACTOR, 3.5 * SCALE_FACTOR, -0.5),
      new Vector3(-1.0 * SCALE_FACTOR, 2.8 * SCALE_FACTOR, -0.6),
      laPostEntry
    ]);

    // Left Inferior Pulmonary Vein
    const pulmonaryVeinLeftInf = new CatmullRomCurve3([
      lungLInfPos,
      new Vector3(-2.5 * SCALE_FACTOR, 2.2 * SCALE_FACTOR, -0.5),
      new Vector3(-1.0 * SCALE_FACTOR, 2.0 * SCALE_FACTOR, -0.6),
      laPostEntry
    ]);

    // Right Superior Pulmonary Vein
    const pulmonaryVeinRightSup = new CatmullRomCurve3([
      lungRSupPos,
      new Vector3(2.5 * SCALE_FACTOR, 3.5 * SCALE_FACTOR, -0.5),
      new Vector3(1.5 * SCALE_FACTOR, 2.8 * SCALE_FACTOR, -0.6),
      laPostEntry
    ]);

    // Right Inferior Pulmonary Vein
    const pulmonaryVeinRightInf = new CatmullRomCurve3([
      lungRInfPos,
      new Vector3(2.5 * SCALE_FACTOR, 2.2 * SCALE_FACTOR, -0.5),
      new Vector3(1.5 * SCALE_FACTOR, 2.0 * SCALE_FACTOR, -0.6),
      laPostEntry
    ]);

    // Visual Pulmonary Trunk (The T-shape exiting RV)
    const pulmonaryTrunkVisual = new CatmullRomCurve3([
      POS_RV,
      pulmoTrunkStart,
      new Vector3(pulmoTrunkStart.x - 0.5, pulmoTrunkStart.y + 0.2, pulmoTrunkStart.z),
    ]);


    // --- Systemic Upper (Head/Upper Body) ---
    // Aorta Exits LV (Top center of LV) -> Arches over Heart -> Goes Up/Down
    
    const aortaRoot = new Vector3(POS_LV.x, POS_LV.y + 1.2, POS_LV.z);
    const aorticArch = new Vector3(0.0, 2.8 * SCALE_FACTOR, 0.2); // Top of arch - scaled
    
    const upperBedInlet = new Vector3(BODY_UPPER_POS.x - BED_WIDTH_HALF, BODY_UPPER_POS.y - BED_HEIGHT_HALF, 0); 
    const upperBedOutlet = new Vector3(BODY_UPPER_POS.x + BED_WIDTH_HALF, BODY_UPPER_POS.y - BED_HEIGHT_HALF, 0); 
    
    // Define transition points for arterioles/venules (2.5 units below capillary bed)
    const MICROVESSEL_GAP = 2.5;
    const upperArteryEnd = new Vector3(upperBedInlet.x, upperBedInlet.y - MICROVESSEL_GAP, 0); // Where main artery ends
    const upperVeinStart = new Vector3(upperBedOutlet.x, upperBedOutlet.y - MICROVESSEL_GAP, -0.1); // Where main vein starts
    
    // Systemic Upper: Main artery ends at transition point (NOT at capillary bed)
    const systemicUpperArtery = new CatmullRomCurve3([
      POS_LV,
      aortaRoot,
      aorticArch, 
      new Vector3(upperArteryEnd.x, upperArteryEnd.y - 1.0, 0), // Approach from below
      upperArteryEnd
    ]);
    
    // Systemic Upper: Main vein starts from transition point (NOT from capillary bed)
    const systemicUpperVein = new CatmullRomCurve3([
      upperVeinStart,
      new Vector3(upperVeinStart.x, upperVeinStart.y - 0.5, -0.15), // Leave downward
      new Vector3(1.2 * SCALE_FACTOR, 3.0 * SCALE_FACTOR, -0.2), 
      new Vector3(0.0, 2.5 * SCALE_FACTOR, -0.2), // SVC Top
      POS_RA
    ]);

    // Visual Aortic Arch - ends at transition point
    const systemicUpperArteryVisual = new CatmullRomCurve3([
      POS_LV,
      aortaRoot,
      aorticArch,
      new Vector3(-0.8 * SCALE_FACTOR, 2.8 * SCALE_FACTOR, 0), // Going towards left shoulder
      upperArteryEnd
    ]);

    // Visual SVC - starts from transition point
    const systemicUpperVeinVisual = new CatmullRomCurve3([
      upperVeinStart,
      new Vector3(1.0 * SCALE_FACTOR, 3.5 * SCALE_FACTOR, -0.2),
      new Vector3(POS_RA.x + 0.2, POS_RA.y + 1.0 * SCALE_FACTOR, POS_RA.z), // Enters top of RA
      POS_RA
    ]);


    // --- Systemic Lower (Lower Body) ---
    // Descending Aorta from Arch
    
    const lowerBedInlet = new Vector3(BODY_LOWER_POS.x - BED_WIDTH_HALF, BODY_LOWER_POS.y + BED_HEIGHT_HALF, 0);
    const lowerBedOutlet = new Vector3(BODY_LOWER_POS.x + BED_WIDTH_HALF, BODY_LOWER_POS.y + BED_HEIGHT_HALF, 0);

    // Define transition points for arterioles/venules (2.5 units above capillary bed for lower body)
    const lowerArteryEnd = new Vector3(lowerBedInlet.x, lowerBedInlet.y + MICROVESSEL_GAP, 0); // Where main artery ends
    const lowerVeinStart = new Vector3(lowerBedOutlet.x, lowerBedOutlet.y + MICROVESSEL_GAP, -0.1); // Where main vein starts

    // Systemic Lower: Main artery ends at transition point (NOT at capillary bed)
    const systemicLowerArtery = new CatmullRomCurve3([
      POS_LV,
      aortaRoot,
      new Vector3(-0.2, 0.0, -0.5), // Behind heart, descending
      new Vector3(lowerArteryEnd.x, lowerArteryEnd.y + 1.0, 0), // Approach from above
      lowerArteryEnd
    ]);
    
    // Systemic Lower: Main vein starts from transition point (NOT from capillary bed)
    const systemicLowerVein = new CatmullRomCurve3([
      lowerVeinStart,
      new Vector3(lowerVeinStart.x, lowerVeinStart.y + 0.5, -0.15), // Leave upward
      new Vector3(0.8, -2.5 * SCALE_FACTOR, -0.3), // IVC starting path
      new Vector3(0.6, -1.0 * SCALE_FACTOR, -0.4), // IVC ascending through abdomen
      new Vector3(0.4, 0.2, -0.5),  // IVC passing behind liver area
      new Vector3(POS_RA.x + 0.3, POS_RA.y - 0.5, POS_RA.z - 0.3), // Approaching RA from below
      POS_RA
    ]);

    // Visual Descending Aorta - ends at transition point
    const systemicLowerArteryVisual = new CatmullRomCurve3([
      aorticArch, // Visually continue from arch
      new Vector3(-0.2, 0.0, -0.5),
      lowerArteryEnd
    ]);

    // Inferior Vena Cava - starts from transition point
    const systemicLowerVeinVisual = new CatmullRomCurve3([
      lowerVeinStart,
      new Vector3(0.8, -2.5 * SCALE_FACTOR, -0.3), // IVC origin from lower body
      new Vector3(0.6, -1.0 * SCALE_FACTOR, -0.4), // Ascending through abdomen
      new Vector3(0.4, 0.2, -0.5),  // Behind liver, approaching diaphragm
      new Vector3(POS_RA.x + 0.3, POS_RA.y - 0.5, POS_RA.z - 0.3), // Just below RA
      POS_RA
    ]);

    // --- Branch Arteries (from aortic arch to upper body) ---
    // Brachiocephalic Trunk (rightmost branch)
    const brachiocephalicArtery = new CatmullRomCurve3([
      aorticArch,
      new Vector3(0.4 * SCALE_FACTOR, 3.2 * SCALE_FACTOR, 0.15),
      new Vector3(0.8 * SCALE_FACTOR, 3.8 * SCALE_FACTOR, 0.1),
      new Vector3(0.6 * SCALE_FACTOR, 4.5 * SCALE_FACTOR, 0)
    ]);

    // Left Common Carotid Artery (middle branch)
    const leftCarotidArtery = new CatmullRomCurve3([
      aorticArch,
      new Vector3(-0.2 * SCALE_FACTOR, 3.3 * SCALE_FACTOR, 0.15),
      new Vector3(-0.3 * SCALE_FACTOR, 4.0 * SCALE_FACTOR, 0.1),
      new Vector3(-0.2 * SCALE_FACTOR, 4.5 * SCALE_FACTOR, 0)
    ]);

    // Left Subclavian Artery (leftmost branch)
    const leftSubclavianArtery = new CatmullRomCurve3([
      aorticArch,
      new Vector3(-0.6 * SCALE_FACTOR, 3.2 * SCALE_FACTOR, 0.1),
      new Vector3(-1.0 * SCALE_FACTOR, 3.8 * SCALE_FACTOR, 0.05),
      new Vector3(-1.2 * SCALE_FACTOR, 4.5 * SCALE_FACTOR, 0)
    ]);

    // --- Branch Arteries (from descending aorta to lower body) ---
    // Left Common Iliac Artery
    const leftIliacArtery = new CatmullRomCurve3([
      new Vector3(-0.2, -1.5 * SCALE_FACTOR, -0.4),
      new Vector3(-0.5 * SCALE_FACTOR, -2.2 * SCALE_FACTOR, -0.2),
      new Vector3(-0.8 * SCALE_FACTOR, -2.8 * SCALE_FACTOR, -0.1),
      new Vector3(-1.2 * SCALE_FACTOR, -3.5 * SCALE_FACTOR, 0)
    ]);

    // Right Common Iliac Artery
    const rightIliacArtery = new CatmullRomCurve3([
      new Vector3(-0.2, -1.5 * SCALE_FACTOR, -0.4),
      new Vector3(0.2 * SCALE_FACTOR, -2.2 * SCALE_FACTOR, -0.2),
      new Vector3(0.5 * SCALE_FACTOR, -2.8 * SCALE_FACTOR, -0.1),
      new Vector3(0.6 * SCALE_FACTOR, -3.5 * SCALE_FACTOR, 0)
    ]);

    // --- Branch Veins (from upper body to SVC) ---
    // Right Brachiocephalic Vein
    const rightBrachiocephalicVein = new CatmullRomCurve3([
      new Vector3(0.8 * SCALE_FACTOR, 4.5 * SCALE_FACTOR, -0.1),
      new Vector3(0.9 * SCALE_FACTOR, 4.0 * SCALE_FACTOR, -0.15),
      new Vector3(0.8 * SCALE_FACTOR, 3.5 * SCALE_FACTOR, -0.2),
      new Vector3(0.5 * SCALE_FACTOR, 3.0 * SCALE_FACTOR, -0.2)
    ]);

    // Left Brachiocephalic Vein
    const leftBrachiocephalicVein = new CatmullRomCurve3([
      new Vector3(-0.6 * SCALE_FACTOR, 4.5 * SCALE_FACTOR, -0.1),
      new Vector3(-0.2 * SCALE_FACTOR, 4.0 * SCALE_FACTOR, -0.15),
      new Vector3(0.2 * SCALE_FACTOR, 3.5 * SCALE_FACTOR, -0.2),
      new Vector3(0.5 * SCALE_FACTOR, 3.0 * SCALE_FACTOR, -0.2)
    ]);

    // --- Branch Veins (from lower body to IVC) ---
    // Left Common Iliac Vein
    const leftIliacVein = new CatmullRomCurve3([
      new Vector3(-0.4 * SCALE_FACTOR, -3.5 * SCALE_FACTOR, -0.1),
      new Vector3(-0.2 * SCALE_FACTOR, -3.0 * SCALE_FACTOR, -0.2),
      new Vector3(0.2 * SCALE_FACTOR, -2.6 * SCALE_FACTOR, -0.25),
      new Vector3(0.6, -2.3 * SCALE_FACTOR, -0.3)
    ]);

    // Right Common Iliac Vein
    const rightIliacVein = new CatmullRomCurve3([
      new Vector3(1.0 * SCALE_FACTOR, -3.5 * SCALE_FACTOR, -0.1),
      new Vector3(0.9 * SCALE_FACTOR, -3.0 * SCALE_FACTOR, -0.2),
      new Vector3(0.8 * SCALE_FACTOR, -2.6 * SCALE_FACTOR, -0.25),
      new Vector3(0.7, -2.3 * SCALE_FACTOR, -0.3)
    ]);

    // --- Arterioles (Systemic - fan out from main artery end to capillary bed inlet) ---
    // Upper Body Arterioles - connect from main artery endpoint to capillary bed inlet
    // Fan out from upperArteryEnd to different positions on capillary bed inlet
    const upperArterioles = [
      // Left arteriole (to top of capillary bed)
      new CatmullRomCurve3([
        upperArteryEnd,
        new Vector3(upperArteryEnd.x - 0.4, upperArteryEnd.y + 0.8, 0.15),
        new Vector3(upperBedInlet.x - 0.2, upperBedInlet.y - 0.5, 0.1),
        new Vector3(upperBedInlet.x, upperBedInlet.y + BED_HEIGHT_HALF * 0.5, 0)
      ]),
      // Center arteriole (to middle of capillary bed)
      new CatmullRomCurve3([
        upperArteryEnd,
        new Vector3(upperArteryEnd.x, upperArteryEnd.y + 0.8, 0),
        new Vector3(upperBedInlet.x, upperBedInlet.y - 0.4, 0),
        new Vector3(upperBedInlet.x, upperBedInlet.y, 0)
      ]),
      // Right arteriole (to bottom of capillary bed)
      new CatmullRomCurve3([
        upperArteryEnd,
        new Vector3(upperArteryEnd.x + 0.4, upperArteryEnd.y + 0.8, -0.15),
        new Vector3(upperBedInlet.x + 0.2, upperBedInlet.y - 0.5, -0.1),
        new Vector3(upperBedInlet.x, upperBedInlet.y - BED_HEIGHT_HALF * 0.5, 0)
      ])
    ];

    // Lower Body Arterioles - connect from main artery endpoint to capillary bed inlet
    // Fan out from lowerArteryEnd to different positions on capillary bed inlet
    const lowerArterioles = [
      // Left arteriole (to top of capillary bed)
      new CatmullRomCurve3([
        lowerArteryEnd,
        new Vector3(lowerArteryEnd.x - 0.4, lowerArteryEnd.y - 0.8, 0.15),
        new Vector3(lowerBedInlet.x - 0.2, lowerBedInlet.y + 0.5, 0.1),
        new Vector3(lowerBedInlet.x, lowerBedInlet.y + BED_HEIGHT_HALF * 0.5, 0)
      ]),
      // Center arteriole (to middle of capillary bed)
      new CatmullRomCurve3([
        lowerArteryEnd,
        new Vector3(lowerArteryEnd.x, lowerArteryEnd.y - 0.8, 0),
        new Vector3(lowerBedInlet.x, lowerBedInlet.y + 0.4, 0),
        new Vector3(lowerBedInlet.x, lowerBedInlet.y, 0)
      ]),
      // Right arteriole (to bottom of capillary bed)
      new CatmullRomCurve3([
        lowerArteryEnd,
        new Vector3(lowerArteryEnd.x + 0.4, lowerArteryEnd.y - 0.8, -0.15),
        new Vector3(lowerBedInlet.x + 0.2, lowerBedInlet.y + 0.5, -0.1),
        new Vector3(lowerBedInlet.x, lowerBedInlet.y - BED_HEIGHT_HALF * 0.5, 0)
      ])
    ];

    // --- Venules (Systemic - converge from capillary bed outlet to main vein start) ---
    // Upper Body Venules - converge from capillary bed outlet to main vein start point
    // Fan in from different positions on capillary bed outlet to upperVeinStart
    const upperVenules = [
      // From top of capillary bed
      new CatmullRomCurve3([
        new Vector3(upperBedOutlet.x, upperBedOutlet.y + BED_HEIGHT_HALF * 0.5, 0),
        new Vector3(upperBedOutlet.x + 0.2, upperBedOutlet.y - 0.5, -0.1),
        new Vector3(upperVeinStart.x + 0.4, upperVeinStart.y + 0.8, -0.15),
        upperVeinStart
      ]),
      // From middle of capillary bed
      new CatmullRomCurve3([
        new Vector3(upperBedOutlet.x, upperBedOutlet.y, 0),
        new Vector3(upperBedOutlet.x, upperBedOutlet.y - 0.4, -0.05),
        new Vector3(upperVeinStart.x, upperVeinStart.y + 0.8, -0.1),
        upperVeinStart
      ]),
      // From bottom of capillary bed
      new CatmullRomCurve3([
        new Vector3(upperBedOutlet.x, upperBedOutlet.y - BED_HEIGHT_HALF * 0.5, 0),
        new Vector3(upperBedOutlet.x - 0.2, upperBedOutlet.y - 0.5, -0.1),
        new Vector3(upperVeinStart.x - 0.4, upperVeinStart.y + 0.8, -0.15),
        upperVeinStart
      ])
    ];

    // Lower Body Venules - converge from capillary bed outlet to main vein start point
    // Fan in from different positions on capillary bed outlet to lowerVeinStart
    const lowerVenules = [
      // From top of capillary bed
      new CatmullRomCurve3([
        new Vector3(lowerBedOutlet.x, lowerBedOutlet.y + BED_HEIGHT_HALF * 0.5, 0),
        new Vector3(lowerBedOutlet.x + 0.2, lowerBedOutlet.y + 0.5, -0.1),
        new Vector3(lowerVeinStart.x + 0.4, lowerVeinStart.y - 0.8, -0.15),
        lowerVeinStart
      ]),
      // From middle of capillary bed
      new CatmullRomCurve3([
        new Vector3(lowerBedOutlet.x, lowerBedOutlet.y, 0),
        new Vector3(lowerBedOutlet.x, lowerBedOutlet.y + 0.4, -0.05),
        new Vector3(lowerVeinStart.x, lowerVeinStart.y - 0.8, -0.1),
        lowerVeinStart
      ]),
      // From bottom of capillary bed
      new CatmullRomCurve3([
        new Vector3(lowerBedOutlet.x, lowerBedOutlet.y - BED_HEIGHT_HALF * 0.5, 0),
        new Vector3(lowerBedOutlet.x - 0.2, lowerBedOutlet.y + 0.5, -0.1),
        new Vector3(lowerVeinStart.x - 0.4, lowerVeinStart.y - 0.8, -0.15),
        lowerVeinStart
      ])
    ];

    return { 
      paths: { 
        pulmonaryArteryLeft, pulmonaryArteryRight, 
        pulmonaryVeinLeftSup, pulmonaryVeinLeftInf, pulmonaryVeinRightSup, pulmonaryVeinRightInf,
        systemicUpperArtery, systemicUpperVein, systemicLowerArtery, systemicLowerVein, 
        pathRAtoRV, pathLAtoLV,
        // Branch arteries
        brachiocephalicArtery, leftCarotidArtery, leftSubclavianArtery,
        leftIliacArtery, rightIliacArtery,
        // Branch veins
        rightBrachiocephalicVein, leftBrachiocephalicVein,
        leftIliacVein, rightIliacVein,
        // Arterioles and Venules
        upperArterioles, lowerArterioles,
        upperVenules, lowerVenules
      },
      visualPaths: { 
        systemicUpperArteryVisual, systemicUpperVeinVisual,
        systemicLowerArteryVisual, systemicLowerVeinVisual,
        pulmonaryTrunkVisual
      }
    };
  }, []);

  return (
    <group>
      {/* Heart Anatomy - Tightly Packed */}
      {/* RA: Superior Right (Screen Left) */}
      <HeartChamber position={POS_RA} color="#2563eb" label="RA" bpm={settings.heartRate} phaseOffset={0.15} scale={[0.9, 0.9, 0.9]} />
      
      {/* LA: Superior Left (Screen Right) */}
      <HeartChamber position={POS_LA} color="#ef4444" label="LA" bpm={settings.heartRate} phaseOffset={0.15} scale={[0.8, 0.8, 0.8]} />
      
      {/* RV: Inferior Right (Screen Left), Angled to Apex */}
      <HeartChamber position={POS_RV} color="#1d4ed8" label="RV" bpm={settings.heartRate} phaseOffset={0} scale={[1.0, 1.4, 1.0]} rotation={[0, 0, -0.4]} />
      
      {/* LV: Inferior Left (Screen Right), Angled to Apex, Larger */}
      <HeartChamber position={POS_LV} color="#b91c1c" label="LV" bpm={settings.heartRate} phaseOffset={0} scale={[1.1, 1.6, 1.1]} rotation={[0, 0, 0.4]} />
      
      {/* Lungs */}
      <LungShape position={LUNG_L_POS} label="Left Lung" isLeft={true} />
      <LungShape position={LUNG_R_POS} label="Right Lung" isLeft={false} />
      
      {/* Capillary Beds */}
      <CapillaryBed position={BODY_UPPER_POS} label="Upper Body" flowDirection="systemic" flowSpeed={settings.flowSpeed} />
      <CapillaryBed position={BODY_LOWER_POS} label="Lower Body" flowDirection="systemic" flowSpeed={settings.flowSpeed} />

      {/* Internal Heart Flow */}
      <BloodFlow path={paths.pathRAtoRV} count={15} speed={settings.flowSpeed} radius={0.08} type="internal" overrideColor={COLOR_O2_POOR} />
      <BloodFlow path={paths.pathLAtoLV} count={15} speed={settings.flowSpeed} radius={0.08} type="internal" overrideColor={COLOR_O2_RICH} />

      {/* Pulmonary Arteries (Blue - deoxygenated blood to lungs) */}
      <BloodFlow path={paths.pulmonaryArteryLeft} count={30} speed={settings.flowSpeed} overrideColor={COLOR_O2_POOR} />
      <BloodFlow path={paths.pulmonaryArteryRight} count={30} speed={settings.flowSpeed} overrideColor={COLOR_O2_POOR} />
      
      {/* Pulmonary Veins (Red - oxygenated blood from lungs) */}
      <BloodFlow path={paths.pulmonaryVeinLeftSup} count={20} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.pulmonaryVeinLeftInf} count={20} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.pulmonaryVeinRightSup} count={20} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.pulmonaryVeinRightInf} count={20} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.systemicUpperArtery} count={40} speed={settings.flowSpeed} type="systemic" overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.systemicUpperVein} count={40} speed={settings.flowSpeed} type="systemic" overrideColor={COLOR_O2_POOR} />
      <BloodFlow path={paths.systemicLowerArtery} count={40} speed={settings.flowSpeed} type="systemic" overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.systemicLowerVein} count={40} speed={settings.flowSpeed} type="systemic" overrideColor={COLOR_O2_POOR} />

      {/* Branch Arteries Blood Flow */}
      <BloodFlow path={paths.brachiocephalicArtery} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.leftCarotidArtery} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.leftSubclavianArtery} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.leftIliacArtery} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />
      <BloodFlow path={paths.rightIliacArtery} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_RICH} />

      {/* Branch Veins Blood Flow */}
      <BloodFlow path={paths.rightBrachiocephalicVein} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_POOR} />
      <BloodFlow path={paths.leftBrachiocephalicVein} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_POOR} />
      <BloodFlow path={paths.leftIliacVein} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_POOR} />
      <BloodFlow path={paths.rightIliacVein} count={15} speed={settings.flowSpeed} overrideColor={COLOR_O2_POOR} />

      {/* Visual Vessels */}
      {settings.showVessels && (
        <>
           {/* Pulmonary Arteries (Blue) */}
           <VesselTube path={visualPaths.pulmonaryTrunkVisual} label="Pulmonary Artery" labelPos={0.5} radius={0.2} color="#93c5fd" />
           <VesselTube path={paths.pulmonaryArteryLeft} radius={0.1} color="#93c5fd" /> 
           <VesselTube path={paths.pulmonaryArteryRight} radius={0.1} color="#93c5fd" />
           
           {/* Pulmonary Veins (Red - unique: veins carrying oxygenated blood) */}
           <VesselTube path={paths.pulmonaryVeinLeftSup} label="Pulmonary Veins" labelPos={0.5} radius={0.08} color="#fca5a5" />
           <VesselTube path={paths.pulmonaryVeinLeftInf} radius={0.08} color="#fca5a5" />
           <VesselTube path={paths.pulmonaryVeinRightSup} radius={0.08} color="#fca5a5" />
           <VesselTube path={paths.pulmonaryVeinRightInf} radius={0.08} color="#fca5a5" /> 
           
           {/* Systemic Upper Visuals */}
           <VesselTube path={visualPaths.systemicUpperArteryVisual} label="Aorta" labelPos={0.2} radius={0.22} color="#fca5a5" />
           <VesselTube path={visualPaths.systemicUpperVeinVisual} label="Sup. Vena Cava" labelPos={0.8} radius={0.2} color="#93c5fd" />

           {/* Systemic Lower Visuals */}
           <VesselTube path={visualPaths.systemicLowerArteryVisual} label="Descending Aorta" labelPos={0.3} radius={0.2} color="#fca5a5" />
           <VesselTube path={visualPaths.systemicLowerVeinVisual} label="Inferior Vena Cava" labelPos={0.4} labelOffset={0.5} radius={0.25} color="#93c5fd" />

           {/* Branch Arteries (Red - oxygenated blood) */}
           <VesselTube path={paths.brachiocephalicArtery} radius={0.1} color="#fca5a5" />
           <VesselTube path={paths.leftCarotidArtery} label="Carotid Artery" labelPos={0.6} radius={0.08} color="#fca5a5" />
           <VesselTube path={paths.leftSubclavianArtery} radius={0.08} color="#fca5a5" />
           <VesselTube path={paths.leftIliacArtery} label="Iliac Artery" labelPos={0.5} radius={0.1} color="#fca5a5" />
           <VesselTube path={paths.rightIliacArtery} radius={0.1} color="#fca5a5" />

           {/* Branch Veins (Blue - deoxygenated blood) */}
           <VesselTube path={paths.rightBrachiocephalicVein} radius={0.08} color="#93c5fd" />
           <VesselTube path={paths.leftBrachiocephalicVein} label="Brachiocephalic Vein" labelPos={0.3} radius={0.08} color="#93c5fd" />
           <VesselTube path={paths.leftIliacVein} label="Iliac Vein" labelPos={0.5} radius={0.1} color="#93c5fd" />
           <VesselTube path={paths.rightIliacVein} radius={0.1} color="#93c5fd" />

           {/* Arterioles (Red - oxygenated blood, fan out to capillary beds) */}
           <MicrovesselGroup 
             paths={paths.upperArterioles} 
             color="#fca5a5" 
             label="Arterioles" 
             flowSpeed={settings.flowSpeed}
             labelPos={0.5}
           />
           <MicrovesselGroup 
             paths={paths.lowerArterioles} 
             color="#fca5a5" 
             label="" 
             flowSpeed={settings.flowSpeed}
             labelPos={0.5}
           />

           {/* Venules (Blue - deoxygenated blood, converge from capillary beds) */}
           <MicrovesselGroup 
             paths={paths.upperVenules} 
             color="#93c5fd" 
             label="Venules" 
             flowSpeed={settings.flowSpeed}
             labelPos={0.5}
           />
           <MicrovesselGroup 
             paths={paths.lowerVenules} 
             color="#93c5fd" 
             label="" 
             flowSpeed={settings.flowSpeed}
             labelPos={0.5}
           />
        </>
      )}
    </group>
  );
};
