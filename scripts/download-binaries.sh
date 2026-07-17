#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${YTDLP_BIN_DIR:-./bin}"
mkdir -p "$BIN_DIR"

# ── yt-dlp ──────────────────────────────────────────────────
YTDLP_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
YTDLP_PATH="$BIN_DIR/yt-dlp"

if [ ! -f "$YTDLP_PATH" ]; then
  echo "Downloading yt-dlp..."
  curl -fsSL "$YTDLP_URL" -o "$YTDLP_PATH"
  chmod +x "$YTDLP_PATH"
  echo "yt-dlp installed at $YTDLP_PATH"
fi

# ── ffmpeg ───────────────────────────────────────────────────
FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
FFMPEG_DIR="$BIN_DIR/ffmpeg"

if [ ! -f "$FFMPEG_DIR/ffmpeg" ]; then
  echo "Downloading ffmpeg..."
  TMP_TAR=$(mktemp)
  curl -fsSL "$FFMPEG_URL" -o "$TMP_TAR"
  tar -xf "$TMP_TAR" -C "$BIN_DIR"
  mv "$BIN_DIR"/ffmpeg-*-static "$FFMPEG_DIR"
  chmod +x "$FFMPEG_DIR/ffmpeg" "$FFMPEG_DIR/ffprobe"
  rm -f "$TMP_TAR"
  echo "ffmpeg installed at $FFMPEG_DIR/ffmpeg"
fi

echo "All binaries ready."
