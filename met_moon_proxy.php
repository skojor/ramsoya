<?php
// met_moon_proxy.php
// Enhanced proxy for MET Norway Sunrise Moon API with server-side processing
// © 2025 Skorstad Engineering AS

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
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: public, max-age=' . (CACHE_TTL - (time() - filemtime($cacheFile))));
  header('X-Cache: HIT');
  readfile($cacheFile);
  exit;
}

// Hent fra MET
$ch = curl_init($upstreamUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_MAXREDIRS => 3,
  CURLOPT_TIMEOUT => 10,
  CURLOPT_USERAGENT => 'RamsoyWeatherProxy/1.0 (skorstad.name)',
  CURLOPT_HTTPHEADER => [
    'Accept: application/json',
    'User-Agent: RamsoyWeatherProxy/1.0 (skorstad.name)'
  ]
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false || $error) {
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  http_response_code(500);
  echo json_encode(['error' => 'Failed to fetch moon data: ' . $error]);
  exit;
}

if ($httpCode !== 200) {
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  http_response_code($httpCode);
  echo $response;
  exit;
}

// Dekod MET-respons
$metData = json_decode($response, true);
if (!$metData) {
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *');
  http_response_code(500);
  echo json_encode(['error' => 'Invalid JSON from MET API']);
  exit;
}

// Prosesser månedata
function processMoonData($data) {
    if (!isset($data['properties']['moonphase'])) {
        return null;
    }

    $phase = $data['properties']['moonphase'];
    $props = $data['properties'];

    // Beregn månefase-info
    $phaseNames = [
        [0, 'Nymåne'],
        [45, 'Voksende månesigd'],
        [90, 'Første kvarter'],
        [135, 'Voksende måne'],
        [180, 'Fullmåne'],
        [225, 'Avtagende måne'],
        [270, 'Siste kvarter'],
        [315, 'Avtagende månesigd'],
        [360, 'Nymåne']
    ];

    $phaseName = 'Ukjent fase';
    foreach ($phaseNames as $i => $phaseInfo) {
        if ($phase <= $phaseInfo[0]) {
            $phaseName = $phaseInfo[1];
            break;
        }
    }

    // Beregn belysningsgrad (0-100%)
    $illumination = 50 * (1 - cos(deg2rad($phase)));

    // Generer SVG
    $svg = generateMoonSVG($phase, $illumination);

    // Formatér tekst
    $phaseText = sprintf('%s (%.1f°, %.0f%% belyst)', $phaseName, $phase, $illumination);

    // Legg til måneoppgang/nedgang hvis tilgjengelig
    if (isset($props['moonrise']['time'])) {
        $moonrise = new DateTime($props['moonrise']['time']);
        $moonrise->setTimezone(new DateTimeZone('Europe/Oslo'));
        $phaseText .= sprintf('\nMåneoppgang: %s', $moonrise->format('H:i'));
    }

    if (isset($props['moonset']['time'])) {
        $moonset = new DateTime($props['moonset']['time']);
        $moonset->setTimezone(new DateTimeZone('Europe/Oslo'));
        $phaseText .= sprintf('\nMånenedgang: %s', $moonset->format('H:i'));
    }

    return [
        'svg' => $svg,
        'text' => $phaseText,
        'phase' => $phase,
        'illumination' => $illumination,
        'phaseName' => $phaseName
    ];
}

function generateMoonSVG($phase, $illumination) {
    $cx = 60;
    $cy = 60;
    $r = 58;

    // Grunnleggende måne-sirkel
    $svg = '<circle cx="60" cy="60" r="58" fill="#2c3e50"/>';

    // Beregn skygge basert på fase
    if ($phase <= 180) {
        // Voksende måne (høyre side blir belyst)
        $offset = ($phase / 180) * $r * 2 - $r;
        if ($phase < 90) {
            // Første halvdel - voksende sigd til første kvarter
            $svg .= sprintf('<ellipse cx="%.1f" cy="60" rx="%.1f" ry="58" fill="#f4d03f"/>',
                           $cx + $offset/2, abs($offset));
        } else {
            // Andre halvdel - første kvarter til fullmåne
            $svg .= sprintf('<circle cx="60" cy="60" r="58" fill="#f4d03f"/>');
            if ($offset < $r) {
                $svg .= sprintf('<ellipse cx="%.1f" cy="60" rx="%.1f" ry="58" fill="#2c3e50"/>',
                               $cx - ($r - abs($offset))/2, $r - abs($offset));
            }
        }
    } else {
        // Avtagende måne (venstre side blir belyst)
        $offset = (($phase - 180) / 180) * $r * 2 - $r;
        if ($phase < 270) {
            // Tredje kvart - fullmåne til siste kvarter
            $svg .= sprintf('<circle cx="60" cy="60" r="58" fill="#f4d03f"/>');
            $svg .= sprintf('<ellipse cx="%.1f" cy="60" rx="%.1f" ry="58" fill="#2c3e50"/>',
                           $cx + ($r - abs($offset))/2, $r - abs($offset));
        } else {
            // Siste kvart - siste kvarter til nymåne
            $svg .= sprintf('<ellipse cx="%.1f" cy="60" rx="%.1f" ry="58" fill="#f4d03f"/>',
                           $cx - abs($offset)/2, abs($offset));
        }
    }

    // Legg til kant-sirkel
    $svg .= '<circle cx="60" cy="60" r="58" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>';

    return $svg;
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
?>
