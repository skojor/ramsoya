<?php
declare(strict_types=1);

// kartverket_proxy.php: Proxy for Kartverket tidal data API
use JetBrains\PhpStorm\NoReturn;

header('Content-Type: application/json; charset=utf-8');

// CONSTANTS

$baseurl = 'https://vannstand.kartverket.no/tideapi.php';
$lat = "64.33";
$lon = "10.41";
// Helper: Send error and exit
#[NoReturn]
function send_error($msg, $code = 500): void
{
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

/**
 * @throws DateMalformedStringException
 */
function buildTidalUrl($baseUrl, $lat, $lon): string
{
    $tz = new DateTimeZone('Europe/Oslo');
    $now = new DateTime('now', $tz);
    $to  = (clone $now)->modify('+72 hours');

    // Oslo offset in hours (e.g. 1 or 2)
    $offsetSeconds = $tz->getOffset($now);
    $tzoneHours = (string)($offsetSeconds / 3600);
    $isDst = (int)$now->format('I'); // 1 if DST, 0 otherwise

    $isoLocal = fn(DateTime $dt) => $dt->format('Y-m-d\TH:i'); // minutes are enough

    $params = [
        'tide_request' => 'locationdata',
        'lat' => (string)$lat,
        'lon' => (string)$lon,
        'datatype' => 'tab',
        'refcode' => 'cd',
        'lang' => 'nb',
        'fromtime' => $isoLocal($now),
        'totime' => $isoLocal($to),
        'tzone' => $tzoneHours,
        'dst' => (string)$isDst,
    ];

    return $baseUrl . '?' . http_build_query($params);
}


// Fetch data from Kartverket
try {
    $tidalUrl = buildTidalUrl($baseurl, $lat, $lon);
} catch (DateMalformedStringException $e) {

}
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $tidalUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_HTTPHEADER => [
        'Accept: text/plain, application/xml;q=0.9, */*;q=0.1',
        'Accept-Language: nb',
        'User-Agent: TidalProxy/1.0 (+yourdomain)'
    ],
]);
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false || $http_code !== 200) {
    send_error('Failed to fetch data from Kartverket: ' . $error, 502);
}

$lines = preg_split('/\r?\n/', trim($response));
foreach ($lines as $line) {
    if ($line === '' || str_starts_with($line, '#')) continue; // skip empty/comment
    $parts = explode("\t", $line);
    if (count($parts) < 3) continue;

    $time = trim($parts[0]);
    $type = trim($parts[1]);
    $cmRaw = trim($parts[2]);

    if (strtotime($time) === false) continue;
    $cm = (float)str_replace(',', '.', $cmRaw);

    $events[] = ['time' => $time, 'type' => $type, 'cm' => $cm];
    usort($events, fn($a,$b) => strcmp($a['time'], $b['time']));

}


// If no events, try to parse as XML (fallback)
if (empty($events) && str_contains($response, '<tide>')) {
    $xml = @simplexml_load_string($response);
    if ($xml && isset($xml->locationdata->data->waterlevel)) {
        foreach ($xml->locationdata->data->waterlevel as $wl) {
            $time = (string)$wl['time'];
            $type = (string)($wl['type'] ?? $wl['flag'] ?? $wl['kind'] ?? $wl['tide']);
            $cm = (string)$wl['value'];
            if (strtotime($time) !== false && is_numeric($cm)) {
                $events[] = [
                    'time' => $time,
                    'type' => $type,
                    'cm' => floatval($cm)
                ];
            }
        }
    }
}

// Return as JSON
if (!empty($events)) {
    echo json_encode(['events' => $events], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    echo json_encode(['events' => []], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}


