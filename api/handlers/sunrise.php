<?php
// Ensure bootstrap defaults are loaded so handler can rely on constants like CACHE_TTL
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/HttpClient.php';

use Ramsoya\Api\Lib\HttpClient;

// Add error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, must-revalidate');

// Debug: Start
error_log("Starting Sunrise API script");

class SunriseService
{
    private const BASE_URL = "https://api.sunrise-sunset.org/json?";
    private const LAT = "64.3278592";
    private const LON = "10.4155161";


    private DateTimeZone $timezone;

    public function __construct()
    {
        $this->timezone = new DateTimeZone('Europe/Oslo');
    }

    /**
     * Fetch sunrise and sunset data from API
     * @throws Exception
     * @throws Exception
     */
    private function fetchSunData(?DateTime $date = null): array
    {
        // Use "today" parameter when no specific date is provided, as per API documentation
        $dateStr = $date === null ? 'today' : $date->format('Y-m-d');

        $url = self::BASE_URL . http_build_query([
                'lat' => self::LAT,
                'lng' => self::LON,
                'date' => $dateStr,
                'formatted' => 0
            ]);

        $resp = HttpClient::get($url, ['User-Agent: SunriseProxy/1.0'], 10, false);
        if ($resp['error'] || $resp['body'] === null) {
            throw new Exception('Failed to fetch sunrise data from API: ' . ($resp['error'] ?? 'HTTP ' . $resp['code']));
        }

        $data = json_decode($resp['body'], true);

        if ($data === null || ($data['status'] ?? '') !== 'OK') {
            throw new Exception('Invalid response from sunrise API');
        }

        return $data['results'];
    }

    /**
     * Convert UTC time to Europe/Oslo timezone
     * @throws Exception
     */
    private function convertToOsloTime($utcTimeStr): ?DateTime
    {
        if (empty($utcTimeStr)) {
            return null;
        }

        $utcTime = new DateTime($utcTimeStr, new DateTimeZone('UTC'));
        $utcTime->setTimezone($this->timezone);

        return $utcTime;
    }


    /**
     * Get all solar events for today and tomorrow
     * @throws Exception
     */
    public function getAllEvents(): array
    {
        try {
            $now = new DateTime('now', $this->timezone);
            $next24Hours = clone $now;
            $next24Hours->add(new DateInterval('PT24H'));

            $today = clone $now;
            $tomorrow = clone $now;
            $tomorrow->add(new DateInterval('P1D'));

            // Fetch data for today and tomorrow
            $todayData = $this->fetchSunData($today);
            $tomorrowData = $this->fetchSunData($tomorrow);

            // Convert all times to Oslo timezone
            $todaySunrise = $this->convertToOsloTime($todayData['sunrise']);
            $todaySunset = $this->convertToOsloTime($todayData['sunset']);
            $tomorrowSunrise = $this->convertToOsloTime($tomorrowData['sunrise']);
            $tomorrowSunset = $this->convertToOsloTime($tomorrowData['sunset']);

            // Collect all events within the next 24 hours in chronological order
            $allEvents = [];

            // Check today's sunrise
            if ($todaySunrise && $todaySunrise >= $now && $todaySunrise <= $next24Hours) {
                $allEvents[] = [
                    'type' => 'sunrise',
                    'datetime' => $todaySunrise,
                    'iso' => $todaySunrise->format('c'),
                    'time' => $todaySunrise->format('H:i'),
                    'label' => 'Soloppgang',
                    'dayLabel' => 'I dag',
                    'icon' => 'sunrise.svg'
                ];
            }

            // Check today's sunset
            if ($todaySunset && $todaySunset >= $now && $todaySunset <= $next24Hours) {
                $allEvents[] = [
                    'type' => 'sunset',
                    'datetime' => $todaySunset,
                    'iso' => $todaySunset->format('c'),
                    'time' => $todaySunset->format('H:i'),
                    'label' => 'Solnedgang',
                    'dayLabel' => 'I dag',
                    'icon' => 'sunset.svg'
                ];
            }

            // Check tomorrow's sunrise (if within 24 hours)
            if ($tomorrowSunrise && $tomorrowSunrise >= $now && $tomorrowSunrise <= $next24Hours) {
                $allEvents[] = [
                    'type' => 'sunrise',
                    'datetime' => $tomorrowSunrise,
                    'iso' => $tomorrowSunrise->format('c'),
                    'time' => $tomorrowSunrise->format('H:i'),
                    'label' => 'Soloppgang',
                    'dayLabel' => 'I morgen',
                    'icon' => 'sunrise.svg'
                ];
            }

            // Check tomorrow's sunset (if within 24 hours)
            if ($tomorrowSunset && $tomorrowSunset >= $now && $tomorrowSunset <= $next24Hours) {
                $allEvents[] = [
                    'type' => 'sunset',
                    'datetime' => $tomorrowSunset,
                    'iso' => $tomorrowSunset->format('c'),
                    'time' => $tomorrowSunset->format('H:i'),
                    'label' => 'Solnedgang',
                    'dayLabel' => 'I morgen',
                    'icon' => 'sunset.svg'
                ];
            }

            // Sort events chronologically
            usort($allEvents, function ($a, $b) {
                return $a['datetime'] <=> $b['datetime'];
            });

            // Remove datetime objects from final output (not JSON serializable)
            foreach ($allEvents as &$event) {
                unset($event['datetime']);
            }

            // Return all events, not just one of each type
            return [
                'events' => $allEvents,
                'count' => count($allEvents),
                'timezone' => 'Europe/Oslo'
            ];

        } catch (Exception $e) {
            error_log("Sunrise API Error: " . $e->getMessage());
            throw $e;
        }
    }
}

// Main execution
try {
    $service = new SunriseService();

    // Check if specific type is requested
    $type = $_GET['type'] ?? 'next';
    $result = $service->getAllEvents();
    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
