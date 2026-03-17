import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { backendFetch } from '../lib/backend'
import { Tooltip } from './ui/tooltip'
import { cn } from '@/lib/utils'

export interface LoraSelection {
  path: string
  name: string
  strength: number
}

interface LoraSelectorProps {
  selectedLoras: LoraSelection[]
  onLorasChange: (loras: LoraSelection[]) => void
  disabled?: boolean
}

interface LoraModel {
  name: string
  path: string
  conditioning_type: string
  reference_downscale_factor: number
}

export function LoraSelector({ selectedLoras, onLorasChange, disabled }: LoraSelectorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [models, setModels] = useState<LoraModel[]>([])
  const [loading, setLoading] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [draggingStrength, setDraggingStrength] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const fetchModels = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await backendFetch('/api/ic-lora/list-models')
      if (resp.ok) {
        const data = await resp.json()
        setModels(data.models || [])
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false)
    }
  }, [])

  const openPicker = useCallback(() => {
    if (disabled) return
    setPickerOpen(true)
    fetchModels()
  }, [disabled, fetchModels])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const addLora = useCallback((model: LoraModel) => {
    if (selectedLoras.some(l => l.path === model.path)) return
    onLorasChange([...selectedLoras, { path: model.path, name: model.name, strength: 1.0 }])
  }, [selectedLoras, onLorasChange])

  const removeLora = useCallback((path: string) => {
    onLorasChange(selectedLoras.filter(l => l.path !== path))
  }, [selectedLoras, onLorasChange])

  const updateStrength = useCallback((path: string, strength: number) => {
    onLorasChange(selectedLoras.map(l => l.path === path ? { ...l, strength } : l))
  }, [selectedLoras, onLorasChange])

  const browseCustom = useCallback(async () => {
    const paths = await window.electronAPI?.showOpenFileDialog?.({
      title: 'Select LoRA File',
      filters: [{ name: 'SafeTensors', extensions: ['safetensors'] }],
    })
    if (paths && paths.length > 0) {
      const filePath = paths[0]
      const name = filePath.split(/[/\\]/).pop()?.replace(/\.safetensors$/, '') || filePath
      if (!selectedLoras.some(l => l.path === filePath)) {
        onLorasChange([...selectedLoras, { path: filePath, name, strength: 1.0 }])
      }
    }
    setPickerOpen(false)
  }, [selectedLoras, onLorasChange])

  const truncateName = (name: string, maxLen = 7) => {
    if (name.length <= maxLen) return name
    return name.slice(0, maxLen - 1) + '…'
  }

  return (
    <div className="flex items-start gap-1.5 flex-wrap">
      {/* Selected LoRA cards */}
      {selectedLoras.map((lora, idx) => (
        <div
          key={lora.path}
          className="relative group flex flex-col items-center"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => { if (!draggingStrength) setHoveredIndex(null) }}
        >
          <Tooltip content={`${lora.name} (${lora.strength.toFixed(2)})`} side="top">
            <div className={cn(
              'w-14 h-14 rounded-lg border border-zinc-700 bg-zinc-800 flex flex-col items-center justify-center cursor-default transition-colors',
              'hover:border-zinc-500',
              disabled && 'opacity-50 cursor-not-allowed'
            )}>
              <span className="text-[10px] text-zinc-300 leading-tight text-center px-1 select-none">
                {truncateName(lora.name)}
              </span>
              <span className="text-[9px] text-zinc-500 mt-0.5 select-none">
                {lora.strength.toFixed(1)}
              </span>
            </div>
          </Tooltip>

          {/* Remove button */}
          {!disabled && (
            <button
              onClick={(e) => { e.stopPropagation(); removeLora(lora.path) }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-600 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          )}

          {/* Horizontal strength slider below card on hover */}
          {hoveredIndex === idx && !disabled && (
            <div
              className="mt-1 flex items-center z-20"
              onMouseDown={() => setDraggingStrength(true)}
              onMouseUp={() => setDraggingStrength(false)}
            >
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={lora.strength}
                onChange={(e) => updateStrength(lora.path, parseFloat(e.target.value))}
                onMouseUp={() => { setDraggingStrength(false); setHoveredIndex(null) }}
                className="w-14 h-3 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
              />
            </div>
          )}
        </div>
      ))}

      {/* Add LoRA button */}
      <div className="relative">
        <Tooltip content="Add LoRA" side="top">
          <button
            onClick={openPicker}
            disabled={disabled}
            className={cn(
              'w-14 h-14 rounded-lg border border-dashed border-zinc-600 bg-zinc-800/50 flex items-center justify-center transition-colors',
              'hover:border-zinc-500 hover:bg-zinc-800',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Plus className="w-5 h-5 text-zinc-500" />
          </button>
        </Tooltip>

        {/* Picker dropdown */}
        {pickerOpen && (
          <div
            ref={pickerRef}
            className="absolute bottom-full left-0 mb-2 w-72 max-h-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col"
          >
            <div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase">Available LoRAs</span>
              <button onClick={() => setPickerOpen(false)} className="p-0.5 hover:bg-zinc-700 rounded">
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-1.5">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                </div>
              ) : models.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No LoRA files found</p>
              ) : (
                models.map((model) => {
                  const isSelected = selectedLoras.some(l => l.path === model.path)
                  return (
                    <button
                      key={model.path}
                      onClick={() => { addLora(model); setPickerOpen(false) }}
                      disabled={isSelected}
                      className={cn(
                        'w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors',
                        isSelected
                          ? 'text-zinc-500 cursor-default bg-zinc-700/30'
                          : 'text-zinc-300 hover:bg-zinc-700 cursor-pointer'
                      )}
                    >
                      <div className="truncate">{model.name}</div>
                      {isSelected && (
                        <span className="text-[10px] text-zinc-500">Already added</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            <button
              onClick={browseCustom}
              className="mx-1.5 mb-1.5 px-2.5 py-2 rounded-md text-sm text-blue-400 hover:bg-zinc-700 transition-colors text-left"
            >
              Browse custom file…
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
