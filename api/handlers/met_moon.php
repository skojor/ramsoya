<?php
// Ensure bootstrap defaults are loaded so handler can rely on constants like CACHE_TTL
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/HttpClient.php';

use Ramsoya\Api\Lib\HttpClient;

// met_moon.php
// Enhanced proxy for MET Norway Sunrise Moon API with server-side processing
// © 2025 Skorstad Engineering AS

// Tillatte query-parametre (whitelist)
$allowedParams = ['lat','lon','date','offset','elevation','day','to','lang'];

// Bygg URL med whitelistede parametre
$base = 'https://api.met.no/weatherapi/sunrise/3.0/moon';
$q = array_filter($_GET, function ($k) use ($allowedParams) {
    return in_array($k, $allowedParams, true);
}, ARRAY_FILTER_USE_KEY);
$upstreamUrl = $base . (empty($q) ? '' : ('?' . http_build_query($q)));

// Enkelt cache-oppsett (filbasert)
$cacheKey  = sha1($upstreamUrl);
$cacheDir  = sys_get_temp_dir() . '/met_moon_cache';
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';

if (!is_dir($cacheDir)) {
  @mkdir($cacheDir, 0775, true);
}

// Returner cache hvis fersk
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < CACHE_TTL)) {
  header('Access-Control-Allow-Origin: *');
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: public, max-age=' . (CACHE_TTL - (time() - filemtime($cacheFile))));
  header('X-Cache: HIT');
  readfile($cacheFile);
  exit;
}

// Hent fra MET via HttpClient
$headers = [
    'Accept: application/json',
    'User-Agent: RamsoyWeatherProxy/1.0 (skorstad.name)'
];

$resp = HttpClient::get($upstreamUrl, $headers, 10, false);
$httpCode = $resp['code'] ?? 0;
$error = $resp['error'] ?? null;
$body = $resp['body'] ?? null;

if ($body === null || $error) {
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  http_response_code(500);
  echo json_encode(['error' => 'Failed to fetch moon data: ' . ($error ?? 'HTTP ' . $httpCode)]);
  exit;
}

if ($httpCode !== 200) {
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  http_response_code($httpCode);
  echo $body;
  exit;
}

// Dekod MET-respons
$metData = json_decode($body, true);
if (!$metData) {
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  http_response_code(500);
  echo json_encode(['error' => 'Invalid JSON from MET API']);
  exit;
}

// Helper functions
function getPhaseName($deg): string
{
    $d = fmod(fmod($deg, 360) + 360, 360); // Normalize to 0-360

    if ($d < 10 || $d >= 350) return "Nymåne";
    if (abs($d - 90) < 10) return "Første kvarter";
    if (abs($d - 180) < 10) return "Fullmåne";
    if (abs($d - 270) < 10) return "Siste kvarter";

    return $d < 180 ? "Voksende" : "Minkende";
}

function generateMoonSVG($phase): string
{
    $size = 120;
    $r = $size / 2;
    $cx = $r;
    $cy = $r;
    $phi = ($phase * M_PI) / 180;
    $rx = abs(cos($phi)) * $r;


    // Helper function to sample points along a curve
    $sample = function($from, $to, $fn) {
        $N = 64; // Number of sample points
        $pts = [];
        for ($i = 0; $i <= $N; $i++) {
            $t = $from + ($to - $from) * ($i / $N);
            $pts[] = $fn($t);
        }
        return $pts;
    };

    // Circle function
    $circle = function($t) use ($cx, $cy, $r) {
        return [$cx + $r * cos($t), $cy + $r * sin($t)];
    };

    // Right ellipse function
    $eRight = function($t) use ($cx, $cy, $r, $rx) {
        return [$cx + $rx * cos($t), $cy + $r * sin($t)];
    };

    // Left ellipse function
    $eLeft = function($t) use ($cx, $cy, $r, $rx) {
        return [$cx - $rx * cos($t), $cy + $r * sin($t)];
    };

    $pts = [];

    if ($phase <= 180) {
        $pts = array_merge($pts, $sample(-M_PI/2, M_PI/2, $circle));
        if ($phase <= 90) {
            $pts = array_merge($pts, $sample(M_PI/2, -M_PI/2, $eRight));
        } else {
            $pts = array_merge($pts, $sample(M_PI/2, -M_PI/2, $eLeft));
        }
    } else {
        $pts = array_merge($pts, $sample(M_PI/2, 3*M_PI/2, $circle));
        if ($phase <= 270) {
            $pts = array_merge($pts, $sample(-M_PI/2, M_PI/2, $eRight));
        } else {
            $pts = array_merge($pts, $sample(-M_PI/2, M_PI/2, $eLeft));
        }
    }

    // Build the path data
    $pathData = "M " . number_format($pts[0][0], 3) . " " . number_format($pts[0][1], 3);
    for ($i = 1; $i < count($pts); $i++) {
        $pathData .= " L " . number_format($pts[$i][0], 3) . " " . number_format($pts[$i][1], 3);
    }
    $pathData .= " Z";

    // Build the SVG
    $defs = '<defs><filter id="moonGlow" x="-50%" y="-50%" width="200%" height="200%">' .
            '<feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b1"/>' .
            '<feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>' .
            '</filter></defs>';

    $bg = sprintf('<circle cx="%d" cy="%d" r="%d" fill="#1e2228"/>', $cx, $cy, $r);
    $lit = sprintf('<g filter="url(#moonGlow)"><path d="%s" fill="#ffffff"/></g>', $pathData);
    $rim = sprintf('<circle cx="%d" cy="%d" r="%.1f" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>',
                   $cx, $cy, $r - 0.6);

    return $defs . $bg . $lit . $rim;
}

// Prosesser månedata - ONLY simple format
function processMoonData($data): ?array
{
    if (!isset($data['properties']['moonphase'])) {
        return null;
    }

    $phase = $data['properties']['moonphase'];

    // Beregn belysningsgrad som i originalen: (1 - cos(deg * PI / 180)) / 2
    $illumination = (1 - cos(deg2rad($phase))) / 2;

    // Generer SVG
    $svg = generateMoonSVG($phase);

    // Beregn fasenavn akkurat som originalen
    $phaseName = getPhaseName($phase);

    // Formatér tekst akkurat som originalen: "Voksende • 87%" - NOTHING ELSE
    $phaseText = sprintf('%s 	 %d%%', $phaseName, round($illumination * 100.0));

    return [
        'svg' => $svg,
        'text' => $phaseText,
        'phase' => $phase,
        'illumination' => $illumination * 100,
        'phaseName' => $phaseName
    ];
}

// Prosesser dataene
$processed = processMoonData($metData);

// Bygg endelig respons
$result = $metData; // Inkluder original data
$result['processed'] = $processed; // Legg til prosesserte data

// Lagre til cache
file_put_contents($cacheFile, json_encode($result));

// Send respons
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=' . CACHE_TTL);
header('X-Cache: MISS');

echo json_encode($result);
