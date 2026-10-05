export const LOGO_BUCKET = 'site-logos'
export const LOGO_MAX_BYTES = 5 * 1024 * 1024
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const DEFAULT_SITE_LOGOS = {
  ecfa: '/badges/ecfa-embroidered.png',
  'charity-forget-me-notes': '/charities/forget-me-notes-v2.png',
  'charity-dont-screen-us-out': '/charities/dont-screen-us-out-v2.svg',
}

export function validateLogoFile(file) {
  if (!file) return 'Choose a logo to upload.'
  if (!LOGO_MIME_TYPES.includes(file.type)) return 'Use a PNG, JPG or WebP image.'
  if (!file.size || file.size > LOGO_MAX_BYTES) return 'Use an image no larger than 5 MB.'
  return ''
}

export function logoUploadPath(target, file) {
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type]
  return `${target.category}/${target.id}/${crypto.randomUUID()}.${extension}`
}

export function notifyLogosChanged() {
  window.dispatchEvent(new Event('ecfa-logos-changed'))
}
