<?php
// met_forecast_proxy.php — Proxy for MET Locationforecast/2.0 compact
// © deg. Husk å endre app-navn/kontakt!

require("../../private/met_forecastcred.php");

// Tillatte parametre
$allowed = ['lat','lon','altitude']; // elevation alias
$q = array_filter($_GET, function ($k) use ($allowed) {
    return in_array($k, $allowed, true);
}, ARRAY_FILTER_USE_KEY);
// MET anbefaler å inkludere elevation
if (!isset($q['elevation']) && isset($q['altitude'])) $q['elevation'] = $q['altitude'];

$base = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
$up   = $base . (empty($q) ? '' : ('?' . http_build_query($q)));

$cacheDir = sys_get_temp_dir() . '/met_forecast_cache';
@mkdir($cacheDir, 0775, true);
$key  = sha1($up);
$file = "$cacheDir/$key.json";
$hdrs = "$cacheDir/$key.h";

// Server fersk cache
if (file_exists($file) && time() - filemtime($file) < CACHE_TTL) {
  header('Access-Control-Allow-Origin: *');
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: public, max-age=' . (CACHE_TTL - (time() - filemtime($file))));
  if (file_exists($hdrs)) {
    $h = @json_decode(@file_get_contents($hdrs), true) ?: [];
    foreach ($h as $line) header($line, false);
  }
  header('X-Cache: HIT');
  readfile($file);
  exit;
}

// Hent fra MET
$ch = curl_init($up);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 12,
  CURLOPT_CONNECTTIMEOUT => 6,
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_HTTPHEADER => [
    'Accept: application/json',
    'User-Agent: ' . APP_NAME . ' (' . CONTACT . ')'
  ],
  CURLOPT_HEADER => true,
]);

$resp = curl_exec($ch);
if ($resp === false) {
  http_response_code(502);
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  echo json_encode(['error'=>'Upstream fetch failed','detail'=>curl_error($ch)], JSON_UNESCAPED_UNICODE);
  curl_close($ch);
  exit;
}

$hsz   = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$code  = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$hraw  = substr($resp, 0, $hsz);
$body  = substr($resp, $hsz);
curl_close($ch);

// Plukk ut noen overskrifter for viderelevering
$out = [];
foreach (explode("\r\n", $hraw) as $line) {
  if (stripos($line, 'ETag:')===0 ||
      stripos($line, 'Last-Modified:')===0 ||
      stripos($line, 'Expires:')===0 ||
      stripos($line, 'Cache-Control:')===0) {
    $out[] = $line;
  }
}

http_response_code($code);
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
foreach ($out as $h) header($h, false);

if ($code === 200) {
  json_decode($body);
  if (json_last_error() === JSON_ERROR_NONE) {
    @file_put_contents($file, $body);
    @file_put_contents($hdrs, json_encode($out));
  }
  header('X-Cache: MISS');
  echo $body;
} else {
  echo $body;
}
