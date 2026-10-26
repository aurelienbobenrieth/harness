/** Runtime output is never changed source, even when a browser puts it under src. */
export function isSource(file) {
  return (
    /\.[cm]?[jt]sx?$/.test(file) &&
    !file
      .split(/[\\/]/)
      .some((part) =>
        /^(?:\.agents|\.claude|node_modules|\.?browser-profile.*|\.?(?:chrome|chromium|edge)-profile.*|chrome-user-data|user-data-dir|\.playwright|playwright-report|test-results|\.cache|coverage|dist|BrowserMetrics|Crashpad)$/.test(
          part,
        ),
      )
  );
}
