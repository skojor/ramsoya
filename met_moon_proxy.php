<?php
// met_moon_proxy.php
// Proxy for MET Norway Sunrise Moon API (https://api.met.no/weatherapi/sunrise/3.0/moon)
// Sikker og enkel, med liten cache. © deg selv 🤝

require("../private/met_forecastcred.php");

// Tillatte query-parametre (whitelist)
$allowedParams = ['lat','lon','date','offset','elevation','day','to','lang'];

// Bygg URL med whitelistede parametre
$base = 'https://api.met.no/weatherapi/sunrise/3.0/moon';
$q = [];
foreach ($_GET as $k => $v) {
  if (in_array($k, $allowedParams, true)) {
    $q[$k] = $v;
  }
}
$upstreamUrl = $base . (empty($q) ? '' : ('?' . http_build_query($q)));

// Enkelt cache-oppsett (filbasert)
$cacheKey  = sha1($upstreamUrl);
$cacheDir  = sys_get_temp_dir() . '/met_moon_cache';
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';
$metaFile  = $cacheDir . '/' . $cacheKey . '.headers';

if (!is_dir($cacheDir)) {
  @mkdir($cacheDir, 0775, true);
}

// Returner cache hvis fersk
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < CACHE_TTL)) {
  header('Access-Control-Allow-Origin: *');
  if (file_exists($metaFile)) {
    // send lagrede headere (trygt under kontroll)
    $headers = @json_decode(@file_get_contents($metaFile), true) ?: [];
    foreach ($headers as $h) { header($h, false); }
  } else {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=' . (CACHE_TTL - (time() - filemtime($cacheFile))));
  }
  header('X-Cache: HIT');
  readfile($cacheFile);
  exit;
}

// Hent fra MET
$ch = curl_init($upstreamUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_CONNECTTIMEOUT => 6,
  CURLOPT_TIMEOUT        => 12,
  CURLOPT_HTTPHEADER     => [
    'Accept: application/json',
    // MET: identify yourself — app + contact
    'User-Agent: ' . APP_NAME . ' (' . CONTACT . ')'
  ],
  CURLOPT_HEADER => true, // hent både headere og body for videresending
]);

$resp = curl_exec($ch);
if ($resp === false) {
  http_response_code(502);
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  echo json_encode(['error' => 'Upstream fetch failed', 'detail' => curl_error($ch)], JSON_UNESCAPED_UNICODE);
  curl_close($ch);
  exit;
}

$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$status     = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$headersRaw = substr($resp, 0, $headerSize);
$body       = substr($resp, $headerSize);
curl_close($ch);

// Forbered headere å videresende (filtrér/normaliser)
$outHeaders = [];
$contentType = 'application/json; charset=utf-8';
foreach (explode("\r\n", $headersRaw) as $line) {
  if (stripos($line, 'Content-Type:') === 0) { $contentType = trim(substr($line, 13)); }
  if (stripos($line, 'Cache-Control:') === 0) { $outHeaders[] = $line; }
  if (stripos($line, 'ETag:') === 0)          { $outHeaders[] = $line; }
  if (stripos($line, 'Expires:') === 0)       { $outHeaders[] = $line; }
  if (stripos($line, 'Last-Modified:') === 0) { $outHeaders[] = $line; }
}

// Svar til klient
http_response_code($status);
header('Access-Control-Allow-Origin: *');
header('Content-Type: ' . $contentType);
foreach ($outHeaders as $h) { header($h, false); }

// Legg på egen cache hvis upstream ikke ga noe
$hasCacheHdr = false;
foreach ($outHeaders as $h) { if (stripos($h,'Cache-Control:')===0) { $hasCacheHdr = true; break; } }
if (!$hasCacheHdr) {
  header('Cache-Control: public, max-age=' . CACHE_TTL);
}

// Skriv cache bare når 200 OK og valid JSON
if ($status === 200) {
  // valider at det er JSON (best-effort)
  json_decode($body);
  if (json_last_error() === JSON_ERROR_NONE) {
    @file_put_contents($cacheFile, $body);
    @file_put_contents($metaFile, json_encode([
      'Content-Type: ' . $contentType,
      'Cache-Control: public, max-age=' . CACHE_TTL
    ]));
  }
}

header('X-Cache: MISS');
echo $body;

