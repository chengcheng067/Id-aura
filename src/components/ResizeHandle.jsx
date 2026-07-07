import { useRef, useCallback } from 'react'
import useStore from '../store/useStore'

export default function ResizeHandle() {
  const setAiPanelWidth = useStore((s) => s.setAiPanelWidth)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    const aiPanelWidth = useStore.getState().aiPanelWidth
    startWidth.current = aiPanelWidth

    const handleMouseMove = (e) => {
      if (!isResizing.current) return
      const dx = startX.current - e.clientX
      const newWidth = startWidth.current + dx
      setAiPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [setAiPanelWidth])

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        cursor: 'col-resize',
        zIndex: 10,
        background: 'transparent',
        transition: 'background 150ms ease-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent-default)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    />
  )
}
