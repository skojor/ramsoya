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

if ($status === 200) {
  $moonData = json_decode($body, true);
  if (json_last_error() === JSON_ERROR_NONE && $moonData) {
    // Extract and process moon phase data
    $moonphase = deepFindMoonphase($moonData);
    if ($moonphase !== null && is_numeric($moonphase)) {
      // Normalize degree to 0-360 range
      $degree = fmod(fmod(floatval($moonphase), 360) + 360, 360);

      // Calculate additional moon data
      $phaseName = getPhaseName($degree);
      $illumination = getIlluminationFraction($degree);
      $svg = generateMoonSVG($degree);

      // Create enhanced response with processed data
      $enhancedData = [
        'original' => $moonData,
        'processed' => [
          'degree' => round($degree, 2),
          'phaseName' => $phaseName,
          'illumination' => round($illumination * 100),
          'svg' => $svg,
          'text' => $phaseName . ' • ' . round($illumination * 100) . '%'
        ]
      ];

      $body = json_encode($enhancedData, JSON_UNESCAPED_UNICODE);
    }
  }
}

// Forbered headere å videresende (filtrer/normaliser)
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

// Moon phase processing functions
function deepFindMoonphase($obj) {
  if (!is_array($obj) && !is_object($obj)) {
    return null;
  }

  $array = is_object($obj) ? get_object_vars($obj) : $obj;

  if (isset($array['moonphase'])) {
    $mp = $array['moonphase'];
    if (is_array($mp) && isset($mp['value'])) {
      return floatval($mp['value']);
    }
    if (is_numeric($mp)) {
      return floatval($mp);
    }
  }

  foreach ($array as $value) {
    if (is_array($value) || is_object($value)) {
      $found = deepFindMoonphase($value);
      if ($found !== null && is_numeric($found)) {
        return $found;
      }
    }
  }

  return null;
}

function getPhaseName($degree) {
  $d = fmod($degree + 360, 360);

  if ($d < 10 || $d >= 350) return "Nymåne";
  if (abs($d - 90) < 10) return "Første kvarter";
  if (abs($d - 180) < 10) return "Fullmåne";
  if (abs($d - 270) < 10) return "Siste kvarter";

  return $d < 180 ? "Voksende" : "Minkende";
}

function getIlluminationFraction($degree) {
  return (1 - cos(deg2rad($degree))) / 2;
}

function generateMoonSVG($degree) {
  $size = 120;
  $r = $size / 2;
  $cx = $r;
  $cy = $r;
  $phi = deg2rad($degree);
  $rx = abs(cos($phi)) * $r;
  $N = 64;

  $points = [];

  if ($degree <= 180) {
    // Waxing phase
    $points = array_merge($points, sampleCircle(-M_PI/2, M_PI/2, $cx, $cy, $r, $N/2));
    if ($degree <= 90) {
      $points = array_merge($points, sampleEllipse(M_PI/2, -M_PI/2, $cx, $cy, $rx, $r, $N/2, 'right'));
    } else {
      $points = array_merge($points, sampleEllipse(M_PI/2, -M_PI/2, $cx, $cy, $rx, $r, $N/2, 'left'));
    }
  } else {
    // Waning phase
    $points = array_merge($points, sampleCircle(M_PI/2, 3*M_PI/2, $cx, $cy, $r, $N/2));
    if ($degree <= 270) {
      $points = array_merge($points, sampleEllipse(-M_PI/2, M_PI/2, $cx, $cy, $rx, $r, $N/2, 'right'));
    } else {
      $points = array_merge($points, sampleEllipse(-M_PI/2, M_PI/2, $cx, $cy, $rx, $r, $N/2, 'left'));
    }
  }

  $pathData = pointsToPath($points);

  // SVG components
  $defs = '<defs><filter id="moonGlow" x="-50%" y="-50%" width="200%" height="200%">' .
          '<feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b1"/>' .
          '<feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>' .
          '</filter></defs>';

  $background = '<circle cx="' . $cx . '" cy="' . $cy . '" r="' . $r . '" fill="#1e2228"/>';
  $litPortion = '<g filter="url(#moonGlow)"><path d="' . $pathData . '" fill="#ffffff"/></g>';
  $rim = '<circle cx="' . $cx . '" cy="' . $cy . '" r="' . ($r - 0.6) . '" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>';

  return $defs . $background . $litPortion . $rim;
}

function sampleCircle($from, $to, $cx, $cy, $r, $n) {
  $points = [];
  for ($i = 0; $i <= $n; $i++) {
    $t = $from + ($to - $from) * ($i / $n);
    $points[] = [$cx + $r * cos($t), $cy + $r * sin($t)];
  }
  return $points;
}

function sampleEllipse($from, $to, $cx, $cy, $rx, $ry, $n, $side) {
  $points = [];
  for ($i = 0; $i <= $n; $i++) {
    $t = $from + ($to - $from) * ($i / $n);
    if ($side === 'right') {
      $points[] = [$cx + $rx * cos($t), $cy + $ry * sin($t)];
    } else {
      $points[] = [$cx - $rx * cos($t), $cy + $ry * sin($t)];
    }
  }
  return $points;
}

function pointsToPath($points) {
  if (empty($points)) return '';

  $path = 'M' . round($points[0][0], 3) . ',' . round($points[0][1], 3);
  for ($i = 1; $i < count($points); $i++) {
    $path .= 'L' . round($points[$i][0], 3) . ',' . round($points[$i][1], 3);
  }
  $path .= 'Z';

  return $path;
}
?>
