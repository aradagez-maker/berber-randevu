#!/bin/sh
# Ana sayfayı (../index.html) Railway'in sunacağı tam HTML'e çevirir.
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html><html lang="tr"><head><meta charset="utf-8">' \
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' \
  '<meta name="theme-color" content="#C8102E"><meta name="apple-mobile-web-app-capable" content="yes">' \
  '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="İlhan Randevu">' \
  '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="logo.svg" type="image/svg+xml">' \
  '<link rel="apple-touch-icon" href="icon-180.png">' \
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>' \
  '</head><body>'
  cat app-source.html
  printf '%s\n' '</body></html>'
} > public/index.html
cp public/logo.svg public/logo.svg 2>/dev/null || true
