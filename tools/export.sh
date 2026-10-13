#!/usr/bin/env bash
# =============================================================================
# export.sh — generate every print and digital deliverable into dist/
#
#   bash tools/export.sh
#
# Renders tools/export-face.html at 1:1 device pixels in a headless Chromium
# (Edge or Chrome), so each PNG is a pixel-exact export of the canvas artwork
# rather than a screenshot of a scaled preview.
#
# Fonts come from Google Fonts — run this while online.
#
# TWO THINGS THIS SCRIPT HAS TO WORK AROUND
#   1. Headless Chromium returns before it has finished writing the file, so
#      every output is polled until its size stops changing.
#   2. A shared --user-data-dir fails silently when a previous headless process
#      has not fully exited, so each invocation gets its own profile.
# =============================================================================
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
mkdir -p "$DIST"

# --- locate a headless Chromium ---------------------------------------------
BROWSER=""
for p in "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "/c/Program Files/Microsoft/Edge/Application/msedge.exe" \
         "/c/Program Files/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"; do
  if [ -f "$p" ]; then BROWSER="$p"; break; fi
done
if [ -z "$BROWSER" ]; then
  echo "No Edge or Chrome found. Export the PNGs from card/card.html instead." >&2
  exit 1
fi
echo "browser: $BROWSER"

PROFILE_ROOT="$(mktemp -d)"
PROFILE_N=0
new_profile () {
  PROFILE_N=$((PROFILE_N + 1))
  local d="$PROFILE_ROOT/p$PROFILE_N"
  mkdir -p "$d"
  printf '%s' "$d"
}

COMMON=(--headless=new --disable-gpu --hide-scrollbars --no-first-run
        --no-default-browser-check --disable-extensions)

OK=0; BAD=0

# Short pause without `sleep`, which some shells here refuse in the foreground.
pause_ms () { node -e "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,$1)" 2>/dev/null || true; }

# wait_file <path> [tries] — true once the file exists and its size is stable
wait_file () {
  local f="$1" tries="${2:-50}" i=0 s1 s2
  while [ "$i" -lt "$tries" ]; do
    if [ -s "$f" ]; then
      s1=$(stat -c %s "$f" 2>/dev/null || echo 0)
      pause_ms 250
      s2=$(stat -c %s "$f" 2>/dev/null || echo 0)
      [ "$s1" = "$s2" ] && return 0
    else
      pause_ms 250
    fi
    i=$((i + 1))
  done
  [ -s "$f" ]
}

report () {  # report <path> <label>
  if wait_file "$1"; then
    echo "  ok      $(basename "$1")  $2"
    OK=$((OK + 1))
  else
    echo "  FAILED  $(basename "$1")" >&2
    BAD=$((BAD + 1))
  fi
}

win () { cygpath -w "$1" 2>/dev/null || echo "$1"; }

to_url () {
  local w; w="$(win "$ROOT/$1")"; w="${w//\\//}"
  printf 'file:///%s%s' "$w" "${2:-}"
}

# shot <out.png> <w> <h> <url> [extra args...]
shot () {
  local out="$1" w="$2" h="$3" url="$4"; shift 4
  rm -f "$out"
  "$BROWSER" "${COMMON[@]}" "$@" \
    --user-data-dir="$(new_profile)" \
    --window-size="$w,$h" \
    --virtual-time-budget=14000 \
    --screenshot="$(win "$out")" \
    "$url" >/dev/null 2>&1
  report "$out" "${w}x${h}"
}

# face <front|back> <dpi> <bleed> <suffix> [sampleUrl]
face () {
  local f="$1" dpi="$2" bleed="$3" sfx="$4" sample="${5:-}"
  local w h q
  w=$(awk "BEGIN{printf \"%d\", (3.5 + 2*$bleed) * $dpi + 0.5}")
  h=$(awk "BEGIN{printf \"%d\", (2.0 + 2*$bleed) * $dpi + 0.5}")
  q="?face=$f&dpi=$dpi&bleed=$bleed"
  [ -n "$sample" ] && q="$q&url=$sample"
  shot "$DIST/mahak-jain-card-$f-$sfx.png" "$w" "$h" "$(to_url tools/export-face.html "$q")" \
    --force-device-scale-factor=1
}

echo
echo "[1/4] Print exports — current config (QR shows PENDING until siteUrl is set)"
face front 300 0.125 "300dpi-bleed"
face back  300 0.125 "300dpi-bleed"
face front 600 0.125 "600dpi-bleed"
face back  600 0.125 "600dpi-bleed"
face front 300 0     "300dpi-trim"
face back  300 0     "300dpi-trim"

echo
echo "[2/4] Design preview — QR pointed at the real GitHub URL, so it scans"
SAMPLE="https%3A%2F%2Fgithub.com%2Fmahak-bit"
face front 300 0.125 "PREVIEW-300dpi-github-qr" "$SAMPLE"
face back  300 0.125 "PREVIEW-300dpi-github-qr" "$SAMPLE"

echo
echo "[3/4] Landing page previews"
# Headless Chromium on Windows refuses a window narrower than ~500px, so a
# direct capture cannot show a true phone layout. preview-mobile.html puts the
# page in a 390px iframe, which gets its own layout viewport.
shot "$DIST/mahak-jain-landing-page-mobile.png" 520 1936 "$(to_url tools/preview-mobile.html)" \
  --allow-file-access-from-files --force-device-scale-factor=2
shot "$DIST/mahak-jain-landing-page-desktop.png" 1400 1400 "$(to_url index.html)" \
  --force-device-scale-factor=2

echo
echo "[4/4] Print-ready PDF (two pages, one face per page, 3.75 x 2.25 in)"
rm -f "$DIST/mahak-jain-card.pdf"
"$BROWSER" "${COMMON[@]}" \
  --user-data-dir="$(new_profile)" \
  --force-device-scale-factor=1 \
  --virtual-time-budget=16000 \
  --no-pdf-header-footer \
  --print-to-pdf="$(win "$DIST/mahak-jain-card.pdf")" \
  "$(to_url card/card.html)" >/dev/null 2>&1
report "$DIST/mahak-jain-card.pdf" "vector page, 300 DPI raster artwork"

rm -rf "$PROFILE_ROOT" 2>/dev/null || true

echo
echo "Done — $OK generated, $BAD failed."
ls -1sh "$DIST" | tail -n +2
exit $(( BAD > 0 ))
