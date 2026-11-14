'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as satellite from 'satellite.js';

export const R = 2; // Earth radius in Three.js units
export const EARTH_RADIUS_M = 6371000;

// Coordinate Pipeline: ECEF coordinates (meters) -> Three.js (Y-up)
// In ECEF: X = Prime Meridian, Y = 90°E, Z = North Pole
// Three.js: Y = Up (North), X = X, Z = Y
export function ecefToThree([x, y, z]: [number, number, number]): THREE.Vector3 {
  const scale = R / EARTH_RADIUS_M;
  return new THREE.Vector3(
    x * scale,
    z * scale,
    -y * scale
  );
}

// Convert Geodetic (lat, lon degrees, alt meters) to ECEF (meters)
export function geodeticToECEF(latDeg: number, lonDeg: number, altMeters = 0): [number, number, number] {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const a = 6378137.0; // WGS84 semi-major axis
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const x = (N + altMeters) * cosLat * Math.cos(lonRad);
  const y = (N + altMeters) * cosLat * Math.sin(lonRad);
  const z = (N * (1 - e2) + altMeters) * sinLat;
  return [x, y, z];
}

// Propagate satellite TLE to ECEF at a given date using SGP4
export function computeSatelliteECEF(line1: string, line2: string, date: Date = new Date()): [number, number, number] | null {
  try {
    if (!line1 || !line2) return null;
    const satrec = satellite.twoline2satrec(line1, line2);
    const pv = satellite.propagate(satrec, date);
    if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
    const gmst = satellite.gstime(date);
    const ecf = satellite.eciToEcf(pv.position as satellite.EciVec3<number>, gmst);
    // ecf is in kilometers -> convert to meters
    return [ecf.x * 1000, ecf.y * 1000, ecf.z * 1000];
  } catch {
    return null;
  }
}

// Compute orbital trajectory points over 1 full orbit period (~95 min)
export function computeOrbitTrajectory(line1: string, line2: string, centerDate: Date = new Date()): THREE.Vector3[] {
  try {
    if (!line1 || !line2) return [];
    const satrec = satellite.twoline2satrec(line1, line2);
    const points: THREE.Vector3[] = [];
    const numMinutes = 96;
    const startTime = centerDate.getTime() - (numMinutes / 2) * 60 * 1000;
    for (let i = 0; i <= numMinutes; i += 1.5) {
      const t = new Date(startTime + i * 60 * 1000);
      const pv = satellite.propagate(satrec, t);
      if (pv && pv.position && typeof pv.position !== 'boolean') {
        const gmst = satellite.gstime(t);
        const ecf = satellite.eciToEcf(pv.position as satellite.EciVec3<number>, gmst);
        points.push(ecefToThree([ecf.x * 1000, ecf.y * 1000, ecf.z * 1000]));
      }
    }
    return points;
  } catch {
    return [];
  }
}

// 1. Earth Sphere Component
function Earth() {
  const earthTexture = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/textures/earth-day.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const cloudsTexture = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const loader = new THREE.TextureLoader();
    return loader.load('/textures/earth-clouds.png');
  }, []);

  const cloudsRef = useRef<THREE.Mesh>(null);

  // Subtle clouds drift
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.005;
    }
  });

  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      {/* Photorealistic Solid Earth Sphere with Natural Cosmic Contrast */}
      <mesh>
        <sphereGeometry args={[R, 128, 128]} />
        <meshStandardMaterial
          map={earthTexture || undefined}
          roughness={0.4}
          metalness={0.06}
          color="#ffffff"
          emissive="#06182c"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Cloud Layer with Texture & Drift */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[R * 1.004, 96, 96]} />
        <meshStandardMaterial
          map={cloudsTexture || undefined}
          transparent
          opacity={0.34}
          depthWrite={false}
          color="#ffffff"
        />
      </mesh>

      {/* Atmospheric Rim Glow */}
      <mesh>
        <sphereGeometry args={[R * 1.035, 96, 96]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.28}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// Dynamic Multi-Depth Parallax Starfield Component
function ParallaxSpaceBackground() {
  const deepStars = useRef<THREE.Group>(null);
  const midStars = useRef<THREE.Group>(null);
  const clusterStars = useRef<THREE.Group>(null);

  useFrame(({ pointer }) => {
    // Parallax tracking: stars shift proportionally to mouse pointer coordinates
    if (deepStars.current) {
      deepStars.current.rotation.y += 0.00015;
      deepStars.current.position.x = pointer.x * 0.15;
      deepStars.current.position.y = pointer.y * 0.15;
    }
    if (midStars.current) {
      midStars.current.rotation.y += 0.00035;
      midStars.current.position.x = pointer.x * 0.35;
      midStars.current.position.y = pointer.y * 0.35;
    }
    if (clusterStars.current) {
      clusterStars.current.rotation.y += 0.0002;
      clusterStars.current.position.x = pointer.x * 0.22;
      clusterStars.current.position.y = pointer.y * 0.22;
    }
  });

  return (
    <>
      {/* Deepest Distant Star Layer */}
      <group ref={deepStars}>
        <Stars radius={110} depth={60} count={2400} factor={4} fade speed={0.4} />
      </group>

      {/* Mid-Depth Parallax Star Layer */}
      <group ref={midStars}>
        <Stars radius={65} depth={30} count={900} factor={4.5} fade speed={0.8} />
      </group>

      {/* Cosmic Nebula Cluster Points */}
      <group ref={clusterStars}>
        <Stars radius={45} depth={20} count={280} factor={5.5} fade speed={1.2} />
      </group>
    </>
  );
}

// 2. Realistic 3D Satellite Model Component
function SatelliteModel({ position, isVisible = false }: { position: THREE.Vector3; name?: string; isVisible?: boolean }) {
  const satRef = useRef<THREE.Group>(null);

  // Align satellite to point its dish toward the Earth center (0,0,0)
  useFrame(() => {
    if (satRef.current) {
      satRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <group ref={satRef} position={position}>
      {/* Central Satellite Body (Gold/Silver Foil) */}
      <mesh>
        <boxGeometry args={[0.07, 0.07, 0.1]} />
        <meshStandardMaterial color="#fcd34d" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Left Blue Solar Panel */}
      <mesh position={[-0.14, 0, 0]}>
        <boxGeometry args={[0.18, 0.07, 0.008]} />
        <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Right Blue Solar Panel */}
      <mesh position={[0.14, 0, 0]}>
        <boxGeometry args={[0.18, 0.07, 0.008]} />
        <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Antenna Dish pointing forward */}
      <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.035, 0.03, 16, 1, true]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Glowing Indicator Orb */}
      <mesh>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={isVisible ? '#10b981' : '#38bdf8'} />
      </mesh>
      {/* Glowing Outer Halo */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={isVisible ? '#10b981' : '#0284c7'} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// 3. Ground Station Component with Pulsing Beacon
function GroundStation({ lat = 28.6139, lon = 77.2090 }: { lat?: number; lon?: number }) {
  const stationECEF = useMemo(() => geodeticToECEF(lat, lon, 100), [lat, lon]);
  const stationPos = useMemo(() => ecefToThree(stationECEF), [stationECEF]);

  return (
    <group position={stationPos}>
      {/* Ground Station Glowing Pin */}
      <mesh>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      {/* Beacon Halo */}
      <mesh>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// 4. Orbit Trajectory Line Component
function OrbitLine({ points }: { points: THREE.Vector3[] }) {
  const lineGeometry = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  if (!lineGeometry) return null;

  return (
    // @ts-ignore
    <line geometry={lineGeometry}>
      <lineBasicMaterial color="#38bdf8" transparent opacity={0.65} linewidth={1.5} />
    </line>
  );
}

// 5. Downlink Pointing Beam Component (Between Satellite and Ground Station)
function PointingBeam({ satPos, stationPos, active = false }: { satPos: THREE.Vector3; stationPos: THREE.Vector3; active?: boolean }) {
  const lineGeo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([stationPos, satPos]);
  }, [stationPos, satPos]);

  return (
    // @ts-ignore
    <line geometry={lineGeo}>
      <lineBasicMaterial
        color={active ? '#10b981' : '#38bdf8'}
        transparent
        opacity={active ? 0.75 : 0.3}
        linewidth={active ? 2 : 1}
      />
    </line>
  );
}

export interface EarthSceneProps {
  satelliteECEF?: [number, number, number] | null;
  tle?: { line1: string; line2: string } | null;
  satelliteName?: string;
  isVisible?: boolean | null;
  groundStation?: { lat: number; lon: number };
  isTracking?: boolean;
}

export default function EarthScene({
  satelliteECEF,
  tle,
  satelliteName = 'METEOR-M2 4',
  isVisible = false,
  groundStation = { lat: 28.6139, lon: 77.2090 },
  isTracking = false
}: EarthSceneProps) {
  // Real-time SGP4 propagation state if TLE is provided
  const [currentECEF, setCurrentECEF] = useState<[number, number, number] | null>(satelliteECEF || null);
  const [orbitPoints, setOrbitPoints] = useState<THREE.Vector3[]>([]);

  // Default fallback TLE for METEOR-M2 4 if none provided
  const activeTle = useMemo(() => {
    if (tle && tle.line1 && tle.line2) return tle;
    return {
      line1: '1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997',
      line2: '2 59051  98.7000 120.0000 0010000  45.0000 315.0000 14.20000000 1000'
    };
  }, [tle]);

  // Compute satellite position and orbit trajectory using satellite.js
  useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const ecef = computeSatelliteECEF(activeTle.line1, activeTle.line2, now);
      if (ecef) setCurrentECEF(ecef);
    };

    updatePosition();
    const interval = setInterval(updatePosition, 1000); // 1 Hz real-time update

    // Compute orbit line points
    const pts = computeOrbitTrajectory(activeTle.line1, activeTle.line2, new Date());
    setOrbitPoints(pts);

    return () => clearInterval(interval);
  }, [activeTle]);

  // Three.js Coordinates
  const satThreePos = useMemo(() => {
    if (satelliteECEF) return ecefToThree(satelliteECEF);
    if (currentECEF) return ecefToThree(currentECEF);
    // Initial fallback position at altitude 800 km
    return ecefToThree([4500000, 3000000, 4800000]);
  }, [satelliteECEF, currentECEF]);

  const stationPos = useMemo(() => {
    const ecef = geodeticToECEF(groundStation.lat, groundStation.lon, 100);
    return ecefToThree(ecef);
  }, [groundStation]);

  return (
    <div
      className="relative w-full h-full min-h-[480px] sm:min-h-[530px] lg:min-h-[560px] rounded-2xl overflow-hidden select-none bg-[#020817]"
    >
      {/* Deep cosmic gradient vignette */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45 pointer-events-none mix-blend-screen transition-transform duration-500 ease-out"
        style={{ backgroundImage: "url('/space-starfield.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#020817] via-transparent to-[#020817]/60 pointer-events-none" />

      <Canvas
        camera={{ position: [0, 0.6, 4.0], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#020817']} />

        {/* Cinematic Deep Space Lighting: High Day/Night Contrast & Radiant Sunlit Face */}
        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#ffffff', '#020817', 0.6]} />
        <directionalLight position={[7, 3, 5]} intensity={3.4} />
        <directionalLight position={[-6, 2, -4]} intensity={1.2} color="#60a5fa" />
        <directionalLight position={[0, -4, 3]} intensity={0.8} color="#0284c7" />

        {/* Multi-Layered 3D Parallax Starfield & Cosmic Nebula Depth */}
        <ParallaxSpaceBackground />

        {/* 3D Photorealistic Earth */}
        <Earth />

        {/* Ground Station Location Pin */}
        <GroundStation lat={groundStation.lat} lon={groundStation.lon} />

        {/* Real SGP4 Orbit Trajectory */}
        {orbitPoints.length > 0 && <OrbitLine points={orbitPoints} />}

        {/* Real-time Positioned Satellite */}
        <SatelliteModel
          position={satThreePos}
          isVisible={Boolean(isVisible)}
        />

        {/* Downlink Pointing Beam */}
        <PointingBeam
          satPos={satThreePos}
          stationPos={stationPos}
          active={Boolean(isTracking || isVisible)}
        />

        {/* User Orbit Controls: Free Mouse Rotation and Zoom */}
        <OrbitControls
          enableRotate
          enableZoom
          enablePan={false}
          minDistance={2.4}
          maxDistance={10}
          rotateSpeed={0.8}
        />
      </Canvas>

      {/* Floating 3D Interaction Tip Pill */}
      <div className="absolute top-3 left-3 z-10 bg-slate-950/70 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-slate-300 font-mono text-[10px] pointer-events-none flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
        <span>3D Earth &bull; Drag to rotate &bull; Parallax Depth</span>
      </div>

      {/* Top-Right Active Satellite Indicator Pill */}
      <div className="absolute top-3 right-3 z-10 bg-slate-950/75 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-white font-mono text-xs flex items-center gap-2 shadow-lg pointer-events-none">
        <span className={`w-2 h-2 rounded-full ${isVisible ? 'bg-emerald-400 animate-ping' : 'bg-sky-400'}`} />
        <span className="font-bold text-sky-300">{satelliteName.split(' ')[0]}</span>
        <span className="text-slate-400 text-[10px]">{isVisible ? 'In View' : 'SGP4 Orbit'}</span>
      </div>
    </div>
  );
}
