import { X, Download, ExternalLink } from 'lucide-react'
import useStore from '../store/useStore'
import packageJson from '../../package.json'

/**
 * Update prompt dialog. Surfaced when a newer app version is published
 * in the remote spec.json "app" node (reusing the spec GitHub channel).
 * Offers: open download page, dismiss for this session, or permanently
 * ignore this specific version.
 */
export default function UpdateDialog({ open, onClose }) {
  const appUpdate = useStore((s) => s.appUpdate)
  const dismissAppUpdate = useStore((s) => s.dismissAppUpdate)
  const skipAppVersion = useStore((s) => s.skipAppVersion)

  if (!open || !appUpdate.available || !appUpdate.info) return null
  const info = appUpdate.info
  const current = packageJson.version

  const goDownload = () => {
    const url = info.downloadUrl || 'https://github.com/chengcheng067/Id-aura/releases/latest'
    if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url)
    else window.open(url, '_blank')
  }
  const close = () => {
    dismissAppUpdate()
    onClose && onClose()
  }
  const ignore = () => {
    skipAppVersion(info.latestVersion)
    onClose && onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="glass-strong iridescent-border"
        style={{
          width: 'min(440px, calc(100vw - 32px))',
          borderRadius: 'var(--radius-panel)',
          padding: 20,
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-panel)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: 'var(--accent-gradient)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              letterSpacing: 0.4,
            }}
          >
            更新可用
          </span>
          <button
            onClick={close}
            title="关闭"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          发现新版本 v{info.latestVersion}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          你当前是 v{current}
          {info.critical ? ' · 建议尽快更新' : ''}
        </p>

        {info.releaseNotes && (
          <div
            style={{
              background: 'var(--surface-overlay)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              marginBottom: 16,
              maxHeight: 200,
              overflow: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            {info.releaseNotes.split('\n').map((line, i) => (
              <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{line}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {!info.critical && (
            <button
              onClick={close}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              稍后再说
            </button>
          )}
          {!info.critical && (
            <button
              onClick={ignore}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              忽略此版本
            </button>
          )}
          <button
            onClick={goDownload}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--accent-default)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={15} /> 去下载
          </button>
        </div>

        {info.downloadUrl && (
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, wordBreak: 'break-all' }}>
            <ExternalLink size={12} /> {info.downloadUrl}
          </div>
        )}
      </div>
    </div>
  )
}
