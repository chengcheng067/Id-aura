/**
 * exportImage — Export canvas image cards to local files.
 *
 * Supports two paths:
 *   Electron: uses window.electronAPI.saveFile for native save dialog (single)
 *             and window.electronAPI.writeFile for direct writes (batch auto-naming)
 *   Browser: falls back to <a download> for browser-based download
 *
 * Batch export in Electron: first image uses save dialog to determine directory
 * and prefix, then all subsequent images are auto-named sequentially (prefix-02, prefix-03, …)
 * and written directly without further dialogs.
 *
 * Exports the ORIGINAL image resolution (not the scaled card display size).
 */

/**
 * Check if running inside Electron with the electronAPI bridge available.
 */
export function isElectronEnv() {
  return !!(window.electronAPI && window.electronAPI.isElectron)
}

/**
 * Load an image from a URL and return its natural dimensions + bitmap.
 * @param {string} imageUrl
 * @returns {Promise<{img: HTMLImageElement, naturalWidth: number, naturalHeight: number}|null>}
 */
async function loadImage(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timeout = setTimeout(() => {
      img.src = ''
      resolve(null)
    }, 15000)
    img.onload = () => {
      clearTimeout(timeout)
      resolve({ img, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
    }
    img.onerror = () => {
      clearTimeout(timeout)
      resolve(null)
    }
    img.src = imageUrl
  })
}

/**
 * Convert a Blob to an ArrayBuffer (for Electron IPC).
 * @param {Blob} blob
 * @returns {Promise<ArrayBuffer>}
 */
function blobToArrayBuffer(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Render an image URL to a canvas and return the raw pixel data as an ArrayBuffer.
 * Does NOT trigger any save dialog or download — pure render + encode.
 *
 * @param {string} imageUrl
 * @param {'png'|'jpeg'} format
 * @param {number} [quality=0.92]
 * @returns {Promise<ArrayBuffer|null>}
 */
async function renderImageToBuffer(imageUrl, format, quality = 0.92) {
  const result = await loadImage(imageUrl)
  if (!result) return null

  const { img, naturalWidth, naturalHeight } = result
  const canvas = document.createElement('canvas')
  canvas.width = naturalWidth
  canvas.height = naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight)

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, format === 'jpeg' ? quality : undefined)
  })

  if (!blob) return null
  return blobToArrayBuffer(blob)
}

/**
 * Export a single image to file.
 *
 * @param {string} imageUrl  - The image source (data URL, blob URL, or http URL)
 * @param {'png'|'jpeg'} format - Export format
 * @param {string} fileName - Suggested file name (without extension)
 * @param {number} [quality=0.92] - JPEG quality (0-1), ignored for PNG
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
export async function exportSingleImage(imageUrl, format, fileName, quality = 0.92) {
  try {
    const buffer = await renderImageToBuffer(imageUrl, format, quality)
    if (!buffer) {
      return { success: false, error: '无法加载图片或图片编码失败' }
    }

    const ext = format === 'jpeg' ? 'jpg' : 'png'
    const fullName = `${sanitizeFileName(fileName || 'image')}.${ext}`

    if (isElectronEnv()) {
      const result = await window.electronAPI.saveFile(buffer, fullName)
      if (result && result.filePath) {
        return { success: true, filePath: result.filePath }
      }
      return { success: false, error: '用户取消保存' }
    } else {
      // Browser fallback: trigger download via <a> element
      const blob = new Blob([buffer], { type: format === 'jpeg' ? 'image/jpeg' : 'image/png' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fullName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return { success: true, filePath: fullName }
    }
  } catch (err) {
    return { success: false, error: err.message || '导出失败' }
  }
}

/**
 * Batch export multiple images.
 *
 * **Electron** (with writeFile IPC available):
 *   First image triggers a save dialog to pick directory + prefix.
 *   All remaining images are auto-named (prefix-02, prefix-03, …) and written
 *   directly without further dialogs.
 *
 * **Browser / no writeFile IPC**:
 *   Each image triggers its own <a download> (browser dialog per image).
 *
 * @param {Array<{imageUrl: string, name: string}>} images
 * @param {'png'|'jpeg'} format
 * @param {number} [quality=0.92]
 * @returns {Promise<{success: number, failed: number, errors: Array<{name: string, error: string}>}>}
 */
export async function exportBatchImages(images, format, quality = 0.92) {
  let success = 0
  let failed = 0
  const errors = []

  if (images.length === 0) {
    return { success: 0, failed: 0, errors: [] }
  }

  const ext = format === 'jpeg' ? 'jpg' : 'png'

  // ── Electron: sequential auto-naming ──────────────────────
  if (isElectronEnv() && window.electronAPI?.writeFile) {
    // 1. First image: use save dialog to determine directory + prefix
    const firstResult = await exportSingleImage(
      images[0].imageUrl, format, images[0].name, quality,
    )

    if (!firstResult.success) {
      // First image failed — try remaining images individually via dialog
      failed++
      errors.push({ name: images[0].name || '图片1', error: firstResult.error })
      for (let i = 1; i < images.length; i++) {
        const { imageUrl, name } = images[i]
        const result = await exportSingleImage(imageUrl, format, name, quality)
        if (result.success) {
          success++
        } else {
          failed++
          errors.push({ name: name || `图片${i + 1}`, error: result.error })
        }
      }
      return { success, failed, errors }
    }

    success++ // first image saved successfully

    const firstPath = firstResult.filePath

    // Parse directory: everything before the last backslash
    const lastBackslash = firstPath.lastIndexOf('\\')
    const dir = lastBackslash >= 0 ? firstPath.substring(0, lastBackslash) : ''

    // Parse prefix: strip extension and -01 suffix from filename
    const filename = lastBackslash >= 0 ? firstPath.substring(lastBackslash + 1) : firstPath
    const dotExt = '.' + ext
    const basename = filename.endsWith(dotExt) ? filename.slice(0, -dotExt.length) : filename
    const prefix = basename.replace(/-01$/, '')

    // 2. Remaining images: render and write directly (no dialog)
    for (let i = 1; i < images.length; i++) {
      const { imageUrl, name } = images[i]
      const num = String(i + 1).padStart(2, '0')
      const filePath = dir
        ? `${dir}\\${prefix}-${num}.${ext}`
        : `${prefix}-${num}.${ext}`

      try {
        const buffer = await renderImageToBuffer(imageUrl, format, quality)
        if (!buffer) {
          failed++
          errors.push({ name: name || `图片${i + 1}`, error: '无法加载图片或编码失败' })
          continue
        }

        const writeResult = await window.electronAPI.writeFile(filePath, buffer)
        if (writeResult && writeResult.success) {
          success++
        } else {
          failed++
          errors.push({
            name: name || `图片${i + 1}`,
            error: writeResult?.error || '写入文件失败',
          })
        }
      } catch (err) {
        failed++
        errors.push({ name: name || `图片${i + 1}`, error: err.message || '导出失败' })
      }
    }

    return { success, failed, errors }
  }

  // ── Browser / no writeFile IPC: each image individually ──
  for (let i = 0; i < images.length; i++) {
    const { imageUrl, name } = images[i]
    const result = await exportSingleImage(imageUrl, format, name, quality)
    if (result.success) {
      success++
    } else {
      failed++
      errors.push({ name: name || `图片${i + 1}`, error: result.error })
    }
  }

  return { success, failed, errors }
}

/**
 * Sanitize a file name: remove invalid characters, limit length.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.+$/, '')
    .slice(0, 200)
    .trim() || 'image'
}
