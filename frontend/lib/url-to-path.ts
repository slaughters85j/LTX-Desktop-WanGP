/**
 * Extract a filesystem path from a `file://` URL.
 * Returns `null` when the URL is a blob: or http(s): URL that can't be
 * converted to a local path.  Raw filesystem paths (e.g. `C:\foo\bar`)
 * are returned as-is so callers don't silently lose them.
 */
export function fileUrlToPath(url: string): string | null {
  if (url.startsWith('file://')) {
    let p = decodeURIComponent(url.slice(7)) // file:///Users/x -> /Users/x
    // Strip Windows drive-letter prefix: /C:/... -> C:/...
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1)
    // Strip leading /./ that appears when a relative path was wrapped in file:///
    if (p.startsWith('/./')) p = p.slice(3)
    return p
  }
  // blob: and http(s): URLs can't be converted to local paths
  if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return null
  }
  // Treat anything else as a raw filesystem path (e.g. "C:\foo\bar" or "/home/user/img.png")
  // Strip ./ prefix for relative paths
  if (url.startsWith('./')) return url.slice(2)
  return url
}
