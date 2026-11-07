export const isIOS = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    /iphone|ipod|ipad/.test(ua) ||
    (ua.includes('macintosh') &&
      typeof document !== 'undefined' &&
      'ontouchend' in document)
  )
}
