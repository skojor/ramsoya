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
  CURLOPT_TIMEOUT => 10,
  CURLOPT_USERAGENT => USER_AGENT,
  CURLOPT_HTTPHEADER => [
    'Accept: application/json',
    'Accept-Encoding: gzip, deflate'
  ],
  CURLOPT_ENCODING => '',
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_SSL_VERIFYHOST => 2,
  CURLOPT_HEADER => true,
  CURLOPT_HEADERFUNCTION => function($curl, $header) {
    // Skip denne - vi håndterer headere manuelt
    return strlen($header);
  }
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

if ($response === false) {
  curl_close($ch);
  http_response_code(502);
  header('Content-Type: application/json');
  header('Access-Control-Allow-Origin: *');
  echo json_encode(['error' => 'Failed to fetch from MET API', 'code' => 502]);
  exit;
}

$headers = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);
curl_close($ch);

// Sjekk HTTP-status
if ($httpCode >= 400) {
  http_response_code($httpCode);
  header('Content-Type: application/json');
  header('Access-Control-Allow-Origin: *');
  echo json_encode(['error' => 'MET API returned error', 'code' => $httpCode]);
  exit;
}

// Parse og lagre relevante headere
$responseHeaders = [];
$headerLines = explode("\r\n", $headers);
foreach ($headerLines as $line) {
  if (stripos($line, 'content-type:') === 0 ||
      stripos($line, 'cache-control:') === 0 ||
      stripos($line, 'expires:') === 0 ||
      stripos($line, 'last-modified:') === 0) {
    $responseHeaders[] = trim($line);
  }
}

// Lagre til cache
@file_put_contents($cacheFile, $body);
@file_put_contents($metaFile, json_encode($responseHeaders));

// Send response
header('Access-Control-Allow-Origin: *');
foreach ($responseHeaders as $h) {
  header($h, false);
}
header('X-Cache: MISS');

echo $body;

