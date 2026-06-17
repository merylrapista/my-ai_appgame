import React, { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Cpu, Gamepad2, Info, LayoutGrid, Terminal, HelpCircle, Sparkles, Activity } from 'lucide-react';
import GameCanvas from './components/GameCanvas';
import ModelManager from './components/ModelManager';
import { GameAction } from './types';

export default function App() {
  const [activeAction, setActiveAction] = useState<GameAction>('idle');
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);

  // Use useCallback to prevent unnecessary re-renders in ModelManager loop
  const handleActionTriggered = useCallback((action: GameAction) => {
    setActiveAction(action);
  }, []);

  const handleWebcamStatus = useCallback((active: boolean) => {
    setIsWebcamActive(active);
  }, []);

  const handleModelStatus = useCallback((loaded: boolean) => {
    setIsModelReady(loaded);
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-slate-300 font-sans flex flex-col lg:flex-row overflow-x-hidden selection:bg-emerald-500 selection:text-black">
      
      {/* LEFT SIDEBAR: NEURAL INTERFACE */}
      <aside className="w-full lg:w-80 bg-[#141417] border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shadow-2xl shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isModelReady ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isModelReady ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#64748b]">Neural Engine v2.4</h2>
          </div>
          <h1 className="text-xl font-medium text-white tracking-tight">Gesture Controller</h1>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-6">
          <ModelManager 
            onActionTriggered={handleActionTriggered}
            onWebcamStatusChange={handleWebcamStatus}
            onModelLoadedStatusChange={handleModelStatus}
          />

          {/* Model Telemetry Box */}
          <div className="p-4 bg-[#0a0a0c] rounded-lg border border-slate-800/60 mt-auto">
            <div className="flex justify-between text-[10px] font-mono mb-2">
              <span className="text-slate-500">INFERENCE SPEED:</span>
              <span className={isModelReady ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isModelReady ? '~12ms' : '0ms'}
              </span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-emerald-500 transition-all duration-500 ${isModelReady ? 'w-3/4' : 'w-0'}`}
              ></div>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN AREA: THE GAME ENVIRONMENT */}
      <main className="flex-1 flex flex-col p-4 md:p-8 space-y-6 overflow-y-auto max-h-screen">
        
        {/* TOP STATUS GLOW BAR / TITLE */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500 mb-1">
              CURRENT SESSION
            </p>
            <h1 className="text-2xl font-mono font-bold tracking-wider text-white uppercase flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-emerald-500" />
              8-Bit Gesture Runner
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-[#141417] border border-slate-800 px-3 py-1.5 rounded flex items-center space-x-2 text-xs font-mono">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400">STATUS:</span>
              <strong className={isWebcamActive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}>
                {isWebcamActive ? 'LIVE CAPTURE' : 'STANDBY'}
              </strong>
            </div>

            <div className="bg-[#141417] border border-slate-800 px-3 py-1.5 rounded flex items-center space-x-2 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
              <span className="text-slate-400">DEVICES:</span>
              <strong className="text-slate-300">GPU ENABLED</strong>
            </div>
          </div>
        </div>

        {/* QUICK USER ALERTER BANNER */}
        <motion.div 
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-[#141417] border border-slate-800 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center justify-between text-slate-400 text-xs font-mono"
        >
          <div className="flex gap-3 items-start">
            <Info className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-white font-medium text-[11px] uppercase tracking-wider">
                Real-Time Neural Vision Controller Active
              </p>
              <p className="leading-relaxed text-slate-400">
                Control the hero dinosaur using <strong className="text-yellow-400">😊 Happy face</strong> to <strong className="text-white">JUMP</strong> and <strong className="text-blue-400">😢 Sad/Angry face</strong> to <strong className="text-white">DUCK</strong> — powered by your Teachable Machine emotion model. Keyboard fallback always active during testing.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 bg-[#0a0a0c] border border-slate-800 px-3 py-1.5 rounded text-amber-400 text-[10px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>SYNTH AUDIO SYSTEM CALIBRATED</span>
          </div>
        </motion.div>

        {/* RETRO ARCADE STAGE REDRAW SCREEN */}
        <section className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <LayoutGrid className="text-emerald-500 w-4 h-4" />
              <h3 className="font-mono text-xs font-bold uppercase text-slate-400 tracking-widest">
                ARCADE SYSTEM SCREEN
              </h3>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              STABLE FEED: localhost:3000
            </div>
          </div>

          <GameCanvas 
            currentAction={activeAction} 
            isWebcamActive={isWebcamActive}
            isModelReady={isModelReady}
          />
        </section>

        {/* TELEMETRY & OPERATION SYSTEM MANUAL */}
        <section id="system-manual-panel" className="bg-[#141417] border border-slate-800 rounded-lg p-5 font-mono text-xs space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 border-b border-slate-800/60 pb-3">
            <Terminal className="text-emerald-500 w-5 h-5" />
            <h3 className="font-bold uppercase tracking-widest text-white text-xs">
              TELEMETRY & OPERATION SYSTEM MANUAL
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* MANUAL BOX 1 */}
            <div className="space-y-2 bg-[#0a0a0c] p-4 border border-slate-800/80 rounded-lg">
              <div className="text-white font-medium text-xs uppercase border-b border-slate-850 pb-1.5 flex justify-between items-center">
                <span>🎮 Gameplay Basics</span>
                <span className="text-[9px] text-[#64748b]">ARCADE</span>
              </div>
              <ul className="space-y-1 text-slate-400 leading-normal">
                <li><strong className="text-slate-200">Survival Target:</strong> Dodge spiked cacti, rolling mushrooms, flying drone birds, and neon barrier towers!</li>
                <li><strong className="text-slate-200">Gold Coins:</strong> Collect spinning pixel grid tokens to increase score multipliers.</li>
                <li><strong className="text-slate-200">Level Flow:</strong> Game speed spikes every 150 points for extreme reaction challenges!</li>
              </ul>
            </div>

            {/* MANUAL BOX 2 */}
            <div className="space-y-2 bg-[#0a0a0c] p-4 border border-slate-800/80 rounded-lg">
              <div className="text-white font-medium text-xs uppercase border-b border-slate-800 pb-1.5 flex justify-between items-center">
                <span>🤖 Emotion Controls</span>
                <span className="text-[9px] text-cyan-400 animate-pulse">NEURAL</span>
              </div>
              <ul className="space-y-1 text-slate-400 leading-normal">
                <li><strong className="text-yellow-400">😊 Happy:</strong> Show a happy / smiling face to make the hero <strong className="text-slate-200">JUMP</strong> over spikes and mushrooms!</li>
                <li><strong className="text-blue-400">😢 Sad:</strong> Show a sad / frown face to make the hero <strong className="text-slate-200">DUCK</strong> under flying drone birds.</li>
                <li><strong className="text-slate-300">😐 Neutral:</strong> Relax your expression to maintain the forward run at base speed.</li>
              </ul>
            </div>

            {/* MANUAL BOX 3 */}
            <div className="space-y-2 bg-[#0a0a0c] p-4 border border-slate-800/80 rounded-lg">
              <div className="text-white font-medium text-xs uppercase border-b border-slate-850 pb-1.5 flex justify-between items-center">
                <span>🛠️ Dynamic TM Loading</span>
                <span className="text-[9px] text-[#64748b]">CONFIG</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-left text-[11px]">
                Create coordinates of gestures on Google's Teachable Machine, copy your hosted <strong>Tensorflow.js Web Model URL</strong>, and load it dynamically without re-writing script paths.
              </p>
            </div>

          </div>

          {/* STATUS FOOTER BAR INFO */}
          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="flex gap-4">
              <span>CPU: 14%</span>
              <span>GPU: 32%</span>
              <span className="text-emerald-500">MODEL: OPTIMIZED</span>
            </div>
            <div className="flex gap-4">
              <span>CONNECTION: LOCALHOST:3000</span>
              <span className="px-2 py-0.5 border border-slate-800 rounded text-slate-400">ESC: PAUSE</span>
            </div>
          </div>

        </section>

        {/* CLASSIC RETRO SIMPLE CREDITS FOOTER */}
        <footer className="pt-8 border-t border-slate-800 text-[10px] text-slate-500 text-center select-none font-mono">
          <p>© 2026 8-BIT GESTURE RUNNER ENGINE. POWERED BY TENSORFLOW.JS & TEACHABLE MACHINE.</p>
        </footer>

      </main>
    </div>
  );
}
