import { useState, useRef, useEffect } from 'react'
import { Sparkles, Trash2, Square, ImageIcon, ArrowLeft, Scissors } from 'lucide-react'
import { logger } from '../lib/logger'
import { ImageUploader } from '../components/ImageUploader'
import { AudioUploader } from '../components/AudioUploader'
import { VideoPlayer } from '../components/VideoPlayer'
import { ImageResult } from '../components/ImageResult'
import { SettingsPanel, type GenerationSettings } from '../components/SettingsPanel'
import { ModeTabs, type GenerationMode } from '../components/ModeTabs'
import { LtxLogo } from '../components/LtxLogo'
import { ModelStatusDropdown } from '../components/ModelStatusDropdown'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import { useGeneration } from '../hooks/use-generation'
import { useRetake } from '../hooks/use-retake'
import { useBackend } from '../hooks/use-backend'
import { useProjects } from '../contexts/ProjectContext'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { fileUrlToPath } from '../lib/url-to-path'
import { sanitizeForcedApiVideoSettings } from '../lib/api-video-options'
import { RetakePanel } from '../components/RetakePanel'
import { LoraSelector } from '../components/LoraSelector'

const DEFAULT_SETTINGS: GenerationSettings = {
  model: 'fast',
  duration: 5,
  videoResolution: '540p',
  fps: 24,
  audio: true,
  cameraMotion: 'none',
  aspectRatio: '16:9',
  // Image settings
  imageResolution: '1080p',
  imageAspectRatio: '16:9',
  imageSteps: 8,
}

export function Playground() {
  const { goHome, addPlaygroundCreation, selectedPlaygroundCreation, clearSelectedPlaygroundCreation } = useProjects()
  const { forceApiGenerations, shouldVideoGenerateWithLtxApi } = useAppSettings()
  const [mode, setMode] = useState<GenerationMode>(() => {
    const c = selectedPlaygroundCreation
    if (!c) return 'text-to-video'
    if (c.type === 'image') return 'text-to-image'
    return (c.settings.mode as GenerationMode) || 'text-to-video'
  })
  const [prompt, setPrompt] = useState(() => selectedPlaygroundCreation?.prompt ?? '')
  const [selectedImage, setSelectedImage] = useState<string | null>(() => selectedPlaygroundCreation?.settings.inputImageUrl ?? null)
  const [selectedAudio, setSelectedAudio] = useState<string | null>(() => selectedPlaygroundCreation?.settings.inputAudioUrl ?? null)
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    const c = selectedPlaygroundCreation
    if (!c) return { ...DEFAULT_SETTINGS }
    return {
      ...DEFAULT_SETTINGS,
      model: (c.settings.model === 'fast' || c.settings.model === 'pro' ? c.settings.model : DEFAULT_SETTINGS.model) as 'fast' | 'pro',
      duration: c.settings.duration ?? DEFAULT_SETTINGS.duration,
      videoResolution: c.settings.resolution || DEFAULT_SETTINGS.videoResolution,
      fps: c.settings.fps ?? DEFAULT_SETTINGS.fps,
      audio: c.settings.audio ?? DEFAULT_SETTINGS.audio,
      cameraMotion: c.settings.cameraMotion || DEFAULT_SETTINGS.cameraMotion,
      aspectRatio: c.settings.aspectRatio || DEFAULT_SETTINGS.aspectRatio,
      imageConditioningStrength: c.settings.imageConditioningStrength,
    }
  })
  const [loadedCreation] = useState(() => selectedPlaygroundCreation)

  const { status, processStatus } = useBackend()

  useEffect(() => {
    if (!shouldVideoGenerateWithLtxApi || mode === 'text-to-image') return
    setSettings((prev) => sanitizeForcedApiVideoSettings({ ...prev, model: 'fast' }))
  }, [mode, shouldVideoGenerateWithLtxApi])

  // Force pro model + resolution when audio is attached (A2V only supports pro @ 1080p 16:9)
  useEffect(() => {
    if (selectedAudio && mode !== 'text-to-image') {
      setSettings(prev => {
        if (shouldVideoGenerateWithLtxApi) {
          return sanitizeForcedApiVideoSettings({ ...prev, model: 'pro' }, { hasAudio: true })
        }
        return prev.model !== 'pro' ? { ...prev, model: 'pro' } : prev
      })
    }
  }, [mode, selectedAudio, shouldVideoGenerateWithLtxApi]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle mode change
  const handleModeChange = (newMode: GenerationMode) => {
    setMode(newMode)
  }
  const { 
    isGenerating, 
    progress, 
    statusMessage, 
    videoUrl,
    videoPath,
    imageUrl,
    imagePath,
    error: generationError,
    generate,
    generateImage,
    cancel,
    reset,
  } = useGeneration()

  const {
    submitRetake,
    resetRetake,
    isRetaking,
    retakeStatus,
    retakeError,
    retakeResult,
  } = useRetake()

  const [retakeInput, setRetakeInput] = useState({
    videoUrl: null as string | null,
    videoPath: null as string | null,
    startTime: 0,
    duration: 0,
    videoDuration: 0,
    ready: false,
  })
  const [retakePanelKey, setRetakePanelKey] = useState(0)
  
  // Ref to store generated image URL for "Create video" flow
  const generatedImageRef = useRef<string | null>(null)

  // Track which results we've already saved to avoid duplicates
  const savedResultRef = useRef<string | null>(null)

  // Clear selected creation after we've captured it
  useEffect(() => {
    if (loadedCreation) clearSelectedPlaygroundCreation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Effective video/image URLs: prefer generation results, fall back to loaded creation
  const effectiveVideoUrl = videoUrl || loadedCreation?.videoUrl || null
  const effectiveVideoPath = videoPath || loadedCreation?.videoPath || null
  const effectiveImageUrl = imageUrl || loadedCreation?.imageUrl || null

  // Auto-save playground creations when generation completes
  useEffect(() => {
    if (isGenerating) return
    // Video completed
    if (videoUrl && videoPath && savedResultRef.current !== videoPath) {
      savedResultRef.current = videoPath
      addPlaygroundCreation({
        type: 'video',
        prompt,
        videoUrl,
        videoPath,
        settings: {
          mode,
          model: settings.model,
          duration: settings.duration,
          resolution: settings.videoResolution,
          fps: settings.fps,
          audio: settings.audio,
          cameraMotion: settings.cameraMotion,
          aspectRatio: settings.aspectRatio,
          inputImageUrl: selectedImage || undefined,
          inputAudioUrl: selectedAudio || undefined,
          imageConditioningStrength: settings.imageConditioningStrength,
        },
      })
    }
    // Image completed
    if (imageUrl && imagePath && savedResultRef.current !== imagePath) {
      savedResultRef.current = imagePath
      addPlaygroundCreation({
        type: 'image',
        prompt,
        imageUrl,
        imagePath,
        settings: {
          mode: 'text-to-image',
          model: settings.model,
          resolution: settings.imageResolution || settings.videoResolution,
          aspectRatio: settings.imageAspectRatio || settings.aspectRatio,
        },
      })
    }
  }, [isGenerating, videoUrl, videoPath, imageUrl, imagePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save retake results
  useEffect(() => {
    if (isRetaking || !retakeResult) return
    if (savedResultRef.current === retakeResult.videoPath) return
    savedResultRef.current = retakeResult.videoPath
    addPlaygroundCreation({
      type: 'video',
      prompt,
      videoUrl: retakeResult.videoUrl,
      videoPath: retakeResult.videoPath,
      settings: {
        mode: 'retake',
        model: settings.model,
        resolution: settings.videoResolution,
      },
    })
  }, [isRetaking, retakeResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = () => {
    if (mode === 'retake') {
      if (!retakeInput.videoPath || retakeInput.duration < 2) return
      submitRetake({
        videoPath: retakeInput.videoPath,
        startTime: retakeInput.startTime,
        duration: retakeInput.duration,
        prompt,
        mode: 'replace_audio_and_video',
      })
      return
    }

    if (mode === 'text-to-image') {
      if (!prompt.trim()) return
      // Text-to-image behavior remains tied to raw forceApiGenerations in useGeneration.
      generateImage(prompt, settings)
    } else {
      const effectiveVideoSettings = shouldVideoGenerateWithLtxApi
        ? sanitizeForcedApiVideoSettings(settings)
        : settings
      // Auto-detect: if image is loaded → I2V, otherwise → T2V
      if (!prompt.trim()) return
      const imagePath = selectedImage ? fileUrlToPath(selectedImage) : null
      const audioPath = selectedAudio ? fileUrlToPath(selectedAudio) : null
      if (audioPath) effectiveVideoSettings.model = 'pro'
      generate(prompt, imagePath, effectiveVideoSettings, audioPath)
    }
  }
  
  // Handle "Create video" from generated image
  const handleCreateVideoFromImage = () => {
    if (!effectiveImageUrl) {
      logger.error('No image URL available')
      return
    }

    // imageUrl is already a file:// URL — just pass it as the selected image path
    setSelectedImage(effectiveImageUrl)
    setMode('image-to-video')
    generatedImageRef.current = imageUrl
  }

  const handleClearAll = () => {
    setPrompt('')
    setSelectedImage(null)
    setSelectedAudio(null)
    const baseDefaults = { ...DEFAULT_SETTINGS }
    const shouldSanitizeVideoSettings = shouldVideoGenerateWithLtxApi && mode !== 'text-to-image'
    setSettings(shouldSanitizeVideoSettings ? sanitizeForcedApiVideoSettings(baseDefaults) : baseDefaults)
    if (mode !== 'text-to-image') setMode('text-to-video')
    setRetakeInput({
      videoUrl: null,
      videoPath: null,
      startTime: 0,
      duration: 0,
      videoDuration: 0,
      ready: false,
    })
    setRetakePanelKey((prev) => prev + 1)
    resetRetake()
    reset()
  }

  const isRetakeMode = mode === 'retake'
  const isVideoMode = mode === 'text-to-video' || mode === 'image-to-video'
  const isBusy = isRetakeMode ? isRetaking : isGenerating
  const canGenerate = processStatus === 'alive' && !isBusy && (
    isRetakeMode
      ? retakeInput.ready && !!retakeInput.videoPath
      : !!prompt.trim()
  )

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={goHome}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="h-5 w-5 text-zinc-400" />
          </button>
          <div className="flex items-center gap-2.5">
            <LtxLogo className="h-6 w-auto text-white" />
            <span className="text-zinc-400 text-base font-medium tracking-wide leading-none pt-1 pl-1.5">Playground</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 pr-20">
          {/* Model Status Dropdown */}
          {!forceApiGenerations && <ModelStatusDropdown />}
          
          {/* GPU Info */}
          {status.gpuInfo && (
            <div className="text-sm text-zinc-500">
              {status.gpuInfo.name} ({(status.gpuInfo.vramUsed / 1024).toFixed(1)}GB / {Math.round(status.gpuInfo.vram / 1024)}GB)
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-[500px] border-r border-zinc-800 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Mode Tabs */}
            <ModeTabs
              mode={mode}
              onModeChange={handleModeChange}
              disabled={isBusy}
            />

            {/* Image Upload - Always shown in video mode (optional: makes it I2V) */}
            {isVideoMode && !isRetakeMode && (
              <>
                <ImageUploader
                  selectedImage={selectedImage}
                  onImageSelect={setSelectedImage}
                />
                <AudioUploader
                  selectedAudio={selectedAudio}
                  onAudioSelect={setSelectedAudio}
                />
              </>
            )}

            {isRetakeMode && (
              <RetakePanel
                resetKey={retakePanelKey}
                isProcessing={isRetaking}
                processingStatus={retakeStatus}
                onChange={(data) => setRetakeInput(data)}
              />
            )}

            {/* LoRA Selection — video modes, local generation only */}
            {mode !== 'text-to-image' && !isRetakeMode && !shouldVideoGenerateWithLtxApi && (
              <div>
                <label className="block text-[12px] font-semibold text-zinc-500 mb-2 uppercase leading-4">
                  LoRAs
                </label>
                <LoraSelector
                  selectedLoras={settings.loras || []}
                  onLorasChange={(loras) => setSettings(prev => ({ ...prev, loras }))}
                  disabled={isBusy}
                />
              </div>
            )}

            {/* Prompt Input */}
            <Textarea
              label="Prompt"
              placeholder="Write a prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              helperText="Longer, detailed prompts lead to better, more accurate results."
              charCount={prompt.length}
              maxChars={5000}
              disabled={isBusy}
            />

            {/* Settings */}
            {!isRetakeMode && (
              <SettingsPanel
                settings={settings}
                onSettingsChange={setSettings}
                disabled={isBusy}
                mode={mode}
                forceApiGenerations={shouldVideoGenerateWithLtxApi}
                hasAudio={!!selectedAudio}
              />
            )}

            {/* Error Display */}
            {(generationError || retakeError) && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
                {(generationError || retakeError)!.includes('TEXT_ENCODING_NOT_CONFIGURED') ? (
                  <div className="space-y-2">
                    <p className="text-red-400 font-medium">Text encoding not configured</p>
                    <p className="text-red-400/80">
                      To generate videos, you need to set up text encoding in Settings.
                    </p>
                  </div>
                ) : (generationError || retakeError)!.includes('TEXT_ENCODER_NOT_DOWNLOADED') ? (
                  <div className="space-y-2">
                    <p className="text-red-400 font-medium">Text encoder not downloaded</p>
                    <p className="text-red-400/80">
                      The local text encoder needs to be downloaded (~25 GB).
                    </p>
                  </div>
                ) : (
                  <span className="text-red-400">{generationError || retakeError}</span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleClearAll}
                disabled={isBusy}
                className="flex items-center gap-2 border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>
              
              {isGenerating ? (
                <Button
                  onClick={cancel}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white"
                >
                  <Square className="h-4 w-4" />
                  Stop generation
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                  {isRetakeMode ? (
                    <>
                      <Scissors className="h-4 w-4" />
                      {isRetaking ? 'Retaking...' : 'Retake'}
                    </>
                  ) : mode === 'text-to-image' ? (
                    <>
                      <ImageIcon className="h-4 w-4" />
                      Generate image
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate video
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Result Preview */}
        <div className="flex-1 p-6">
          {mode === 'text-to-image' ? (
            <ImageResult
              imageUrl={effectiveImageUrl}
              isGenerating={isGenerating}
              progress={progress}
              statusMessage={statusMessage}
              onCreateVideo={handleCreateVideoFromImage}
            />
          ) : mode === 'retake' ? (
            <VideoPlayer
              videoUrl={retakeResult?.videoUrl || null}
              videoPath={retakeResult?.videoPath || null}
              videoResolution={settings.videoResolution}
              isGenerating={isRetaking}
              progress={0}
              statusMessage={retakeStatus}
            />
          ) : (
            <VideoPlayer
              videoUrl={effectiveVideoUrl}
              videoPath={effectiveVideoPath}
              videoResolution={settings.videoResolution}
              isGenerating={isGenerating}
              progress={progress}
              statusMessage={statusMessage}
            />
          )}
        </div>
      </main>
    </div>
  )
}
