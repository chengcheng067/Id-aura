import { useState, useCallback } from 'react'
import { FolderOpen, Plus, ArrowRight, FileImage } from 'lucide-react'
import useStore from '../store/useStore'
import { deserializeProject } from '../utils/fileIO'
import packageJson from '../../package.json'

/**
 * WelcomePage — shown on first launch (or when startupBehavior='welcome').
 *
 * Props:
 *   onNewProject: () => void     — start with empty canvas
 *   onContinue:   () => void     — restore from auto-save
 *   onOpenFile:   () => void     — trigger system file picker
 *   recentFiles:  Array<{ name, path, thumbnail, lastModified, cardCount }>
 */
export default function WelcomePage({ onNewProject, onContinue, onOpenFile, recentFiles }) {
  const [dragOver, setDragOver] = useState(false)
  const [dontShow, setDontShow] = useState(false)
  const updateDisplaySettings = useStore((s) => s.updateDisplaySettings)
  const loadProject = useStore((s) => s.loadProject)
  const addCard = useStore((s) => s.addCard)

  const handleCheckboxChange = (e) => {
    setDontShow(e.target.checked)
    updateDisplaySettings({ skipWelcome: e.target.checked })
  }

  // ─── Drop handler: accept .moodboard files and images ──────
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      // Check for .moodboard file first
      const moodboardFile = files.find((f) => f.name.endsWith('.moodboard'))
      if (moodboardFile) {
        loadProject(moodboardFile)
        onContinue()
        return
      }

      // Otherwise, import images
      let imported = false
      files.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file)
          const sourceUrl =
            window.electronAPI && window.electronAPI.getFilePath
              ? window.electronAPI.getFilePath(file) || file.name
              : file.name
          addCard('image', {
            imageUrl: url,
            name: file.name,
            sourceUrl,
            sourceType: 'drag',
          })
          imported = true
        }
      })
      if (imported) onNewProject()
    },
    [loadProject, addCard, onContinue, onNewProject],
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    if (e.currentTarget === e.target) setDragOver(false)
  }, [])

  // ─── Format date ───────────────────────────────────────────
  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-base)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
        gap: 24,
        padding: 40,
        overflow: 'auto',
      }}
    >
      {/* Logo + Title */}
      <div style={{ textAlign: 'center', marginBottom: 8, animation: 'logoReveal 1.2s var(--liquid-ease-out) both' }}>
        <div style={{
          display: 'inline-flex',
          borderRadius: 12,
          padding: 0,
          marginBottom: 12,
          animation: 'pulseRing 2s ease-out infinite',
        }}>
          <img
            src="./assets/icon.png"
            alt="ID Aura"
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              display: 'block',
            }}
          />
        </div>
        <h1
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: 1,
          }}
        >
          ID Aura
        </h1>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginTop: 4,
            display: 'inline-block',
          }}
        >
          v{packageJson.version}
        </span>
      </div>

      {/* Drop zone */}
      <div
        className="glass-medium"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          width: 480,
          height: 100,
          borderRadius: 'var(--radius-panel)',
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-card)',
          border: `2px dashed ${dragOver ? 'var(--accent-default)' : 'var(--border-strong)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
          cursor: 'default',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: dragOver ? 'var(--accent-default)' : 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileImage size={20} strokeWidth={1.5} />
          拖入 .moodboard 或图片文件到此处
        </span>
      </div>

      {/* Recent files */}
      {recentFiles && recentFiles.length > 0 && (
        <div style={{ width: 480, maxWidth: '100%' }}>
          <h3
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              fontWeight: 500,
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            最近文件
          </h3>
          <div
            style={{
              display: 'flex',
              gap: 10,
              overflowX: 'auto',
              paddingBottom: 4,
            }}
          >
            {recentFiles.map((file, i) => (
              <RecentFileCard
                key={file.path || `recent-${i}`}
                file={file}
                formatDate={formatDate}
                onOpen={() => {
                  if (file.path) {
                    // Attempt to fetch and load the file
                    fetch(file.path)
                      .then((r) => r.text())
                      .then((text) => {
                        const project = deserializeProject(text)
                        if (project) {
                          const blob = new Blob([text], { type: 'application/json' })
                          const f = new File([blob], file.name || 'project.moodboard', { type: 'application/json' })
                          useStore.getState().loadProject(f)
                        }
                      })
                      .catch(() => {
                        alert('无法访问该文件，文件可能已被移动或删除')
                        useStore.getState().removeRecentFile(file.path)
                      })
                  } else {
                    // Auto-save entry — continue
                    onContinue()
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <ActionButton
          icon={Plus}
          label="新建画布"
          primary
          onClick={onNewProject}
        />
        <ActionButton
          icon={ArrowRight}
          label="继续上次"
          onClick={onContinue}
        />
        <ActionButton
          icon={FolderOpen}
          label="打开文件"
          onClick={onOpenFile}
        />
      </div>

      {/* Don't show again */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        <input
          type="checkbox"
          checked={dontShow}
          onChange={handleCheckboxChange}
          style={{ accentColor: 'var(--accent-default)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          不再显示
        </span>
      </label>
    </div>
  )
}

// ─── Recent File Card ────────────────────────────────────────

function RecentFileCard({ file, formatDate, onOpen }) {
  const [thumbError, setThumbError] = useState(false)

  return (
    <button
      onClick={onOpen}
      style={{
        width: 160,
        flexShrink: 0,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out, transform 150ms ease-out',
        fontFamily: 'var(--font-family)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)'
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '100%',
          height: 100,
          background: 'var(--surface-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {file.thumbnail && !thumbError ? (
          <img
            src={file.thumbnail}
            alt={file.name}
            onError={() => setThumbError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <FolderOpen size={28} strokeWidth={1.25} style={{ color: 'var(--text-tertiary)' }} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px' }}>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-primary)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {file.name || '自动保存'}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            marginTop: 2,
          }}
        >
          {formatDate(file.lastModified)}
          {file.cardCount != null && ` · ${file.cardCount} 张卡片`}
        </div>
      </div>
    </button>
  )
}

// ─── Action Button ───────────────────────────────────────────

function ActionButton({ icon: Icon, label, primary, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 24px',
        borderRadius: 'var(--radius-card)',
        border: primary
          ? 'none'
          : hovered
            ? '1px solid var(--border-strong)'
            : '1px solid var(--border-default)',
        background: primary
          ? 'var(--accent-default)'
          : hovered
            ? 'var(--surface-card-hover)'
            : 'var(--surface-card)',
        color: primary ? '#fff' : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        transition: 'all 150ms ease-out',
        fontFamily: 'var(--font-family)',
      }}
    >
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </button>
  )
}
