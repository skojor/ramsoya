<?php
declare(strict_types=1);

// detect debug early so we can show fatal/include errors during debugging
$debug = isset($_GET['debug']) && (int)$_GET['debug'] === 1;
if ($debug) {
    @ini_set('display_errors', '1');
    @ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
}

// Ensure bootstrap defaults are loaded so handler can rely on constants like CACHE_TTL
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/HttpClient.php';

use Ramsoya\Api\Lib\HttpClient;
use JetBrains\PhpStorm\NoReturn;

header('Content-Type: application/json; charset=utf-8');

// CONSTANTS

$baseurl = 'https://vannstand.kartverket.no/tideapi.php';
$lat = "64.33";
$lon = "10.41";

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
// Helper: Send error and exit
#[NoReturn]
function send_error($msg, $code = 500): void
{
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

try {
    // Fetch data from Kartverket
    $tidalUrl = buildTidalUrl($baseurl, $lat, $lon);

    // Use HttpClient to fetch plain text response
    $resp = HttpClient::get($tidalUrl, [
        'Accept: text/plain, application/xml;q=0.9, */*;q=0.1',
        'Accept-Language: nb',
        'User-Agent: TidalProxy/1.0 (+yourdomain)'
    ], 10, false);

    $http_code = $resp['code'] ?? 0;
    $error = $resp['error'] ?? null;
    $response = $resp['body'] ?? null;

    if ($response === null || $http_code !== 200) {
        send_error('Failed to fetch data from Kartverket: ' . ($error ?? 'HTTP ' . $http_code), 502);
    }

    $lines = preg_split('/\\r?\\n/', trim($response));
    $events = [];
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
    }

    // Sort events by time
    usort($events, fn($a,$b) => strcmp($a['time'], $b['time']));

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

} catch (Throwable $e) {
    http_response_code(500);
    if ($debug) {
        echo json_encode(['error' => 'Internal error', 'detail' => $e->getMessage(), 'trace' => $e->getTraceAsString()], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['error' => 'Internal server error'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}
