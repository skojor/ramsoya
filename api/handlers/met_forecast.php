<?php
// Ensure bootstrap defaults are loaded so handler can rely on constants like CACHE_TTL
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/HttpClient.php';

use Ramsoya\Api\Lib\HttpClient;

// met_forecast.php — Proxy for MET Locationforecast/2.0 compact
// © deg. Husk å endre app-navn/kontakt!


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

// Hent fra MET via HttpClient
$hdrs_for_request = [
  'Accept: application/json',
  'User-Agent: ' . APP_NAME . ' (' . CONTACT . ')'
];

$resp = HttpClient::get($up, $hdrs_for_request, 12, true);
if ($resp['error'] || $resp['body'] === null) {
  http_response_code(502);
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  echo json_encode(['error'=>'Upstream fetch failed','detail'=>$resp['error'] ?? ('HTTP ' . $resp['code'])], JSON_UNESCAPED_UNICODE);
  exit;
}

// Split headers and body were handled by HttpClient when includeResponseHeaders=true
$body = $resp['body'];
$headersArr = $resp['headers'] ?? [];

// Plukk ut noen overskrifter for viderelevering
$out = [];
foreach ($headersArr as $line) {
  if (stripos($line, 'ETag:')===0 ||
      stripos($line, 'Last-Modified:')===0 ||
      stripos($line, 'Expires:')===0 ||
      stripos($line, 'Cache-Control:')===0) {
    $out[] = $line;
  }
}

http_response_code($resp['code'] ?? 200);
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
foreach ($out as $h) header($h, false);

// Add server timestamps so clients can align their clocks with the server
$serverNowMs = (int) round(microtime(true) * 1000);
$serverNowISO = gmdate('c');

if (($resp['code'] ?? 0) === 200) {
  // Try to decode the upstream body, inject server time, cache and return the modified payload
  $decoded = json_decode($body, true);
  if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
    $decoded['serverNowMs'] = $serverNowMs;
    $decoded['serverNowISO'] = $serverNowISO;
    $outBody = json_encode($decoded, JSON_UNESCAPED_UNICODE);
    @file_put_contents($file, $outBody);
    @file_put_contents($hdrs, json_encode($out));
    header('X-Cache: MISS');
    echo $outBody;
    exit;
  } else {
    // If decoding fails for any reason, fall back to returning the original body
    @file_put_contents($file, $body);
    @file_put_contents($hdrs, json_encode($out));
    header('X-Cache: MISS');
    echo $body;
    exit;
  }
} else {
  echo $body;
  exit;
}
