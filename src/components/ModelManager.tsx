import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';
import { Camera, CameraOff, Check, AlertTriangle, Cpu, HelpCircle, Loader2, Play, Settings2 } from 'lucide-react';
import { GameAction, ModelClassMap } from '../types';
import { audioSynth } from './AudioSynth';

interface ModelManagerProps {
  onActionTriggered: (action: GameAction) => void;
  onWebcamStatusChange: (active: boolean) => void;
  onModelLoadedStatusChange: (loaded: boolean) => void;
}

// Local model extracted from tm-my-image-model.zip → public/model/
// Classes: Happy → jump | Sad, Angry, Disappointed → duck
const DEFAULT_MODEL_URL = '/model/';

// Emotion-to-action keyword map: class names from Teachable Machine → GameAction
// Model classes: Happy, Sad, Angry, Disappointed
const EMOTION_ACTION_MAP: Record<string, import('../types').GameAction> = {
  // Jump triggers
  happy:        'jump',
  smile:        'jump',
  smiling:      'jump',
  excited:      'jump',
  up:           'jump',
  jump:         'jump',
  hand:         'jump',
  raise:        'jump',
  // Duck triggers
  sad:          'duck',
  frown:        'duck',
  angry:        'duck',
  disappointed: 'duck',
  upset:        'duck',
  crouch:       'duck',
  duck:         'duck',
  down:         'duck',
  // Directional (unused in emotion model but kept for generic models)
  left:         'left',
  back:         'left',
  right:        'right',
  run:          'right',
};

export default function ModelManager({
  onActionTriggered,
  onWebcamStatusChange,
  onModelLoadedStatusChange,
}: ModelManagerProps) {
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<tmImage.CustomMobileNet | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ModelClassMap[]>([]);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [predictions, setPredictions] = useState<Array<{ className: string; probability: number }>>([]);
  const [activeGesture, setActiveGesture] = useState<GameAction>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [simulatedAction, setSimulatedAction] = useState<GameAction>('idle');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);


  // Notify parent when model load state changes
  useEffect(() => {
    onModelLoadedStatusChange(!!model);
  }, [model, onModelLoadedStatusChange]);

  useEffect(() => {
    onWebcamStatusChange(webcamEnabled);
  }, [webcamEnabled, onWebcamStatusChange]);

  // Handle setting up default mappings when model classes are loaded/changed.
  // Supports emotion-based class names: happy → jump, sad → duck, neutral → idle
  useEffect(() => {
    if (classes.length > 0) {
      const initialMappings = classes.map((cls) => {
        const clsLower = cls.toLowerCase().trim();
        let action: GameAction = 'idle';

        // First: check exact match in emotion/action keyword map
        if (EMOTION_ACTION_MAP[clsLower]) {
          action = EMOTION_ACTION_MAP[clsLower];
        } else {
          // Fallback: substring matching for partial words
          for (const [keyword, mappedAction] of Object.entries(EMOTION_ACTION_MAP)) {
            if (clsLower.includes(keyword)) {
              action = mappedAction;
              break;
            }
          }
        }

        return {
          className: cls,
          action,
          threshold: 0.75, // Default action trigger threshold
        };
      });
      setMappings(initialMappings);
    }
  }, [classes]);

  // Setup Web/Camera streaming
  const startCamera = async () => {
    setErrorMsg(null);
    setIsCameraLoading(true);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setWebcamEnabled(true);
          setIsCameraLoading(false);
          audioSynth.playBeep();
        };
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      setErrorMsg("Camera error: Please grant permission to access the webcam.");
      setIsCameraLoading(false);
      setWebcamEnabled(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamEnabled(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setPredictions([]);
    setActiveGesture('idle');
  };

  const toggleCamera = () => {
    if (webcamEnabled) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Load the Teachable Machine Model
  const loadTeachableMachineModel = async (customUrl?: string) => {
    const urlToLoad = customUrl || modelUrl;
    if (!urlToLoad) {
      setErrorMsg('Model URL cannot be empty');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    // Standardize URL to have a trailing slash
    let finalizedUrl = urlToLoad.trim();
    if (!finalizedUrl.endsWith('/')) {
      finalizedUrl += '/';
    }

    try {
      // Initialize tfjs backends before loading TM image models
      await tf.ready();

      const modelJsonURL = finalizedUrl + 'model.json';
      const metadataJsonURL = finalizedUrl + 'metadata.json';

      const loadedModel = await tmImage.load(modelJsonURL, metadataJsonURL);
      const labels = loadedModel.getClassLabels();

      setModel(loadedModel);
      setClasses(labels);
      setIsLoading(false);
      audioSynth.playScoreMilestone();
    } catch (err: unknown) {
      console.error('Model load failed', err);
      setErrorMsg(
        'Could not load TM Model. Check that the URL is a valid public Teachable Machine link (e.g. https://teachablemachine.withgoogle.com/models/xxxx/) and allows CORS access.'
      );
      setIsLoading(false);
    }
  };

  // Auto-load the local emotion model on first mount (declared after loadTeachableMachineModel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTeachableMachineModel(DEFAULT_MODEL_URL); }, []);

  // Main recognition loop
  useEffect(() => {
    const predictLoop = async () => {
      if (model && webcamEnabled && videoRef.current) {
        try {
          const prediction = await model.predict(videoRef.current);
          setPredictions(prediction);

          // Find the highest confidence prediction that meets its threshold
          let maxProb = 0;
          let predictedAction: GameAction = 'idle';

          for (const pred of prediction) {
            const mappingForClass = mappings.find((m) => m.className === pred.className);
            if (mappingForClass) {
              if (pred.probability > maxProb && pred.probability >= mappingForClass.threshold) {
                maxProb = pred.probability;
                predictedAction = mappingForClass.action;
              }
            }
          }

          if (predictedAction !== activeGesture) {
            setActiveGesture(predictedAction);
            onActionTriggered(predictedAction);
          }
        } catch (e) {
          console.error("Prediction failed inside animation loop", e);
        }
      }
      animationFrameRef.current = requestAnimationFrame(predictLoop);
    };

    if (model && webcamEnabled) {
      animationFrameRef.current = requestAnimationFrame(predictLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [model, webcamEnabled, mappings, activeGesture, onActionTriggered]);

  // Clean mount/unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleMappingChange = (className: string, action: GameAction) => {
    setMappings((prev) =>
      prev.map((m) => (m.className === className ? { ...m, action } : m))
    );
    audioSynth.playBeep();
  };

  const handleThresholdChange = (className: string, threshold: number) => {
    setMappings((prev) =>
      prev.map((m) => (m.className === className ? { ...m, threshold } : m))
    );
  };

  const handleSimulatedGesture = (action: GameAction) => {
    setSimulatedAction(action);
    onActionTriggered(action);
    audioSynth.playBeep();
  };

  return (
    <div id="gesture-controller-card" className="flex flex-col h-full bg-[#141417] border border-slate-800 rounded-lg overflow-hidden relative shadow-2xl">
      <div className="absolute inset-0 pointer-events-none border border-black/10 z-10"></div>
      
      {/* SCANLINES RETRO EFFECT */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] z-20"></div>

      {/* HEADER */}
      <div className="bg-[#141417] p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Cpu className="text-emerald-500 w-4 h-4" />
          <h2 className="text-white font-mono text-xs tracking-widest uppercase font-bold">
            GESTURE ENGINE
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setShowHelp(!showHelp);
              audioSynth.playBeep();
            }}
            id="help-toggle-btn"
            className="text-slate-400 hover:text-emerald-400 p-1 rounded hover:bg-slate-800/60 transition"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-[#0a0a0c] border border-slate-800 rounded font-mono text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${model ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`}></span>
            <span className={model ? 'text-emerald-400' : 'text-red-400'}>
              {model ? 'LOADED' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[580px] scrollbar-thin scrollbar-thumb-slate-800">
        
        {/* MODEL INPUT LOADER */}
        <div className="bg-[#0a0a0c] p-4 border border-slate-800/80 rounded-lg font-mono text-xs text-slate-300 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-500 uppercase text-[10px] tracking-wider font-bold">
              Teachable Machine Model URL
            </label>
            <div className="flex gap-2">
              <input
                id="model-url-input"
                type="text"
                value={modelUrl}
                onChange={(e) => setModelUrl(e.target.value)}
                placeholder="Paste public model URL..."
                className="bg-black text-[11px] font-mono text-emerald-400 tracking-tight flex-1 px-3 py-1.5 border border-slate-800 rounded outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
              />
              <button
                id="load-model-btn"
                onClick={() => loadTeachableMachineModel()}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-500 active:translate-y-0.5 disabled:opacity-50 text-white text-[11px] uppercase font-bold tracking-widest px-3.5 py-1.5 rounded transition shadow-inner font-mono flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                LOAD
              </button>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 leading-normal flex gap-1.5 items-start bg-[#141417] border border-slate-800 p-2.5 rounded">
            <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Generate a model on Teachable Machine, click <strong>Upload shareable link</strong> under TensorFlow.js, and paste the URL here.
            </span>
          </div>

          {/* SAMPLES LOADER HELP SHORTCUTS */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[9px] text-slate-500 self-center">Presets:</span>
            {/* 😊 Local emotion model: Happy→jump, Sad/Angry/Disappointed→duck */}
            <button
              id="model-preset-emotion-btn"
              onClick={() => {
                setModelUrl('/model/');
                loadTeachableMachineModel('/model/');
              }}
              className="bg-amber-950/40 hover:bg-amber-900/50 border border-amber-700/50 text-[10px] px-2.5 py-1 rounded text-amber-300 hover:text-amber-200 transition cursor-pointer font-bold tracking-wide"
            >
              😊 Emotion Model (Local)
            </button>
            <button
              id="model-preset-1-btn"
              onClick={() => {
                setModelUrl('https://teachablemachine.withgoogle.com/models/v9bZLQV_P/');
                loadTeachableMachineModel('https://teachablemachine.withgoogle.com/models/v9bZLQV_P/');
              }}
              className="bg-[#141417] hover:bg-[#1f1f24] border border-slate-800 text-[10px] px-2.5 py-1 rounded text-slate-400 hover:text-emerald-400 transition cursor-pointer"
            >
              Default Gen
            </button>
            <button
              id="model-preset-2-btn"
              onClick={() => {
                setModelUrl('https://teachablemachine.withgoogle.com/models/b27M8miz2/');
                loadTeachableMachineModel('https://teachablemachine.withgoogle.com/models/b27M8miz2/');
              }}
              className="bg-[#141417] hover:bg-[#1f1f24] border border-slate-800 text-[10px] px-2.5 py-1 rounded text-slate-400 hover:text-emerald-400 transition cursor-pointer"
            >
              Pose controls
            </button>
          </div>
        </div>

        {/* ERROR DISPLAY */}
        {errorMsg && (
          <div id="gesture-error-alert" className="bg-red-950/20 border border-red-900/40 p-3 rounded flex gap-2 items-start text-xs font-mono text-red-450">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* WEBCAM FEED PREVIEW */}
        <div className="relative aspect-[4/3] w-full bg-black border border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between p-3 shadow-inner">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${webcamEnabled ? 'opacity-80' : 'opacity-0'} transition-opacity`}
          />

          {/* CRT Grid visual overlay only when webcam is active */}
          {webcamEnabled && (
            <div className="absolute inset-0 pointer-events-none border border-emerald-500/10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)] z-10"></div>
          )}

          {/* Webcam Status / Off Placeholder */}
          {!webcamEnabled && !isCameraLoading && (
            <div className="m-auto flex flex-col items-center text-center space-y-2 z-10">
              <div className="w-10 h-10 rounded-full border border-slate-800 flex items-center justify-center bg-[#141417] text-slate-500 shadow-inner">
                <CameraOff className="w-5 h-5" />
              </div>
              <p className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                WEBCAM PREVIEW OFFLINE
              </p>
              <button
                id="enable-webcam-placeholder-btn"
                onClick={startCamera}
                className="bg-[#0a0a0c] hover:bg-black border border-slate-800 text-emerald-400 text-[9px] font-mono px-2.5 py-1 rounded tracking-widest uppercase hover:border-emerald-500 transition cursor-pointer"
              >
                CONNECT CAMERA
              </button>
            </div>
          )}

          {isCameraLoading && (
            <div className="m-auto flex flex-col items-center text-center space-y-2 z-10">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <p className="text-[#a1a1aa] font-mono text-[9px] uppercase tracking-wider animate-pulse">
                Stream Connecting...
              </p>
            </div>
          )}

          {/* LIVE DATA WATERMARK */}
          {webcamEnabled && (
            <>
              <div className="z-10 flex justify-between items-start font-mono text-[9px] text-emerald-400">
                <div className="bg-black/60 px-2 py-0.5 rounded border border-emerald-500/20 backdrop-blur-sm">
                  LIVE VIDEO • FEED: RUNNING
                </div>
                <div className="bg-black/60 px-2 py-0.5 rounded border border-emerald-500/20 backdrop-blur-sm">
                  320x240 • 30FPS
                </div>
              </div>

              {/* ACTIVE GESTURE OVERLAY HUD */}
              <div className="z-10 bg-black/60 px-4 py-1.5 rounded-lg border border-emerald-500/30 backdrop-blur-sm self-center text-center">
                <div className="text-[9px] font-mono text-emerald-500/70 tracking-wider uppercase font-bold">RECOGNIZED</div>
                <div className={`text-lg font-mono font-bold tracking-widest uppercase animate-pulse ${
                  activeGesture === 'jump' ? 'text-yellow-400' :
                  activeGesture === 'duck' ? 'text-blue-400' :
                  'text-emerald-400'
                }`}>
                  {activeGesture === 'idle' ? '— NEUTRAL —' :
                   activeGesture === 'jump' ? '😊 HAPPY → JUMP' :
                   activeGesture === 'duck' ? '😢 SAD → DUCK' :
                   activeGesture.toUpperCase()}
                </div>
              </div>

              <div className="z-10 flex justify-between items-end">
                <button
                  id="stop-camera-panel-btn"
                  onClick={stopCamera}
                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[9px] px-2 py-1 rounded transition flex items-center gap-1 font-mono uppercase cursor-pointer"
                >
                  <CameraOff className="w-3 h-3" /> Stop
                </button>
                <div className="bg-black/60 px-2 py-0.5 rounded border border-emerald-500/20 text-[9px] text-emerald-400 font-mono">
                  GESTURE: {activeGesture.toUpperCase()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CONTROLLER BUTTONS TO ENABLE / MANUALLY TEST */}
        {!webcamEnabled && (
          <div className="bg-[#0a0a0c] p-3 border border-slate-800 rounded font-mono text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                Test / Simulate Controls:
              </span>
              <span className="text-[9px] text-emerald-500 animate-pulse uppercase">Keys Online</span>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5">
              <button
                id="simulate-jump-btn"
                onMouseDown={() => handleSimulatedGesture('jump')}
                onMouseUp={() => handleSimulatedGesture('idle')}
                onTouchStart={() => handleSimulatedGesture('jump')}
                onTouchEnd={() => handleSimulatedGesture('idle')}
                className={`border text-[10px] font-bold py-1.5 rounded transition uppercase cursor-pointer ${simulatedAction === 'jump' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#141417] text-slate-400 border-slate-800 hover:border-slate-700'}`}
              >
                Jump (Up / W)
              </button>
              <button
                id="simulate-duck-btn"
                onMouseDown={() => handleSimulatedGesture('duck')}
                onMouseUp={() => handleSimulatedGesture('idle')}
                onTouchStart={() => handleSimulatedGesture('duck')}
                onTouchEnd={() => handleSimulatedGesture('idle')}
                className={`border text-[10px] font-bold py-1.5 rounded transition uppercase cursor-pointer ${simulatedAction === 'duck' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#141417] text-slate-400 border-slate-800 hover:border-slate-700'}`}
              >
                Duck (Down / S)
              </button>
              <button
                id="simulate-left-btn"
                onMouseDown={() => handleSimulatedGesture('left')}
                onMouseUp={() => handleSimulatedGesture('idle')}
                onTouchStart={() => handleSimulatedGesture('left')}
                onTouchEnd={() => handleSimulatedGesture('idle')}
                className={`border text-[10px] font-bold py-1.5 rounded transition uppercase cursor-pointer ${simulatedAction === 'left' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#141417] text-slate-400 border-slate-800 hover:border-slate-700'}`}
              >
                Left (A / ←)
              </button>
              <button
                id="simulate-right-btn"
                onMouseDown={() => handleSimulatedGesture('right')}
                onMouseUp={() => handleSimulatedGesture('idle')}
                onTouchStart={() => handleSimulatedGesture('right')}
                onTouchEnd={() => handleSimulatedGesture('idle')}
                className={`border text-[10px] font-bold py-1.5 rounded transition uppercase cursor-pointer ${simulatedAction === 'right' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-[#141417] text-slate-400 border-slate-800 hover:border-slate-700'}`}
              >
                Right (D / →)
              </button>
            </div>
          </div>
        )}

        {/* WEBCAM TOGGLE BUTTON OUTSIDE */}
        {!isCameraLoading && (
          <button
            id="toggle-camera-main-btn"
            onClick={toggleCamera}
            className={`w-full font-mono font-bold tracking-widest text-[10.5px] py-2 rounded transition flex items-center justify-center gap-2 border-2 cursor-pointer ${webcamEnabled ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}
          >
            {webcamEnabled ? (
              <>
                <CameraOff className="w-4 h-4" /> STOP WEB FEED
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" /> START WEB FEED
              </>
            )}
          </button>
        )}

        {/* CONFIDENCE BREAKDOWN LIST */}
        {model && webcamEnabled && predictions.length > 0 && (
          <div className="bg-[#0a0a0c] p-3 border border-slate-800 rounded font-mono text-xs space-y-2">
            <div className="flex items-center space-x-1">
              <Settings2 className="text-emerald-500 w-3.5 h-3.5" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                CLASS CONFIDENCE LEVELS
              </span>
            </div>

            <div className="space-y-1.5">
              {predictions.map((pred) => {
                const mapInfo = mappings.find((m) => m.className === pred.className);
                const percent = Math.round(pred.probability * 100);
                const isTriggered = mapInfo && pred.probability >= mapInfo.threshold;

                return (
                  <div key={pred.className} className="space-y-0.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-300 font-bold tracking-wide">
                        {pred.className}
                      </span>
                      <span className={isTriggered ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {percent}% {isTriggered ? '⚡' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-[#141417] h-1.5 rounded overflow-hidden flex items-stretch">
                      <div
                        className={`h-full transition-all duration-75 ${isTriggered ? 'bg-[#10b981]' : 'bg-slate-700'}`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MAPPING CONFIGURATION SCHEMATICS */}
        {model && classes.length > 0 && (
          <div className="bg-[#0a0a0c] p-3 border border-slate-800 rounded font-mono text-xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Teachable Mappings
              </span>
              <span className="text-[9px] text-[#64748b]">Threshold</span>
            </div>

            {mappings.map((mapItem) => (
              <div key={mapItem.className} className="flex flex-col gap-1 text-[11px] pb-2 border-b border-slate-850 last:border-0">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 truncate max-w-[124px] font-bold">
                    {mapItem.className}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <select
                      value={mapItem.action}
                      onChange={(e) => handleMappingChange(mapItem.className, e.target.value as GameAction)}
                      className="bg-[#141417] text-emerald-400 text-[10px] px-1.5 py-0.5 rounded outline-none border border-slate-800 focus:border-slate-700 w-[68px]"
                    >
                      <option value="idle">Stand</option>
                      <option value="jump">Jump</option>
                      <option value="duck">Duck</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                    <span className="text-[10px] text-slate-400 text-right w-8">
                      {Math.round(mapItem.threshold * 100)}%
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min="0.4"
                  max="0.95"
                  step="0.05"
                  value={mapItem.threshold}
                  onChange={(e) => handleThresholdChange(mapItem.className, parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#141417] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            ))}
          </div>
        )}

        {/* HOW TO RUN INSTRUCTIONS IN DRAWER */}
        {showHelp && (
          <div id="gesture-guide-drawer" className="bg-black/40 p-4 border border-slate-800 rounded-lg font-mono text-slate-400 text-[11.5px] leading-relaxed space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-300 font-bold uppercase pb-1 border-b border-slate-800">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>TEACHABLE MACHINE GUIDE</span>
            </div>
            {/* Emotion control legend */}
            <div className="bg-[#0a0a0c] border border-slate-800 rounded p-2.5 space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Your Model Classes → Actions</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <span className="text-yellow-400 font-bold">😊 Happy → JUMP</span>
                <span className="text-blue-400 font-bold">😢 Sad → DUCK</span>
                <span className="text-blue-400 font-bold">😠 Angry → DUCK</span>
                <span className="text-blue-400 font-bold">😞 Disappointed → DUCK</span>
              </div>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-slate-400">
              <li>Model is <strong className="text-emerald-400">loaded locally</strong> from <code className="text-amber-400">/public/model/</code>.</li>
              <li>Click <strong>😊 Emotion Model (Local)</strong> preset to reload if needed.</li>
              <li>Enable your webcam and start playing — smile to jump, frown to duck!</li>
              <li>Use the threshold sliders below to tune sensitivity per class.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
