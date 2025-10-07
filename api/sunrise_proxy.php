<?php

// Add error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, must-revalidate');

// Debug: Start
error_log("Starting Sunrise API script");

class SunriseService {
    private const BASE_URL = "https://api.sunrise-sunset.org/json?";
    private const LAT = "64.3278592";
    private const LON = "10.4155161";


    private $timezone;

    public function __construct() {
        $this->timezone = new DateTimeZone('Europe/Oslo');
    }

    /**
     * Fetch sunrise and sunset data from API
     */
    private function fetchSunData($date = null) {
        // Use "today" parameter when no specific date is provided, as per API documentation
        $dateStr = $date === null ? 'today' : $date->format('Y-m-d');

        $url = self::BASE_URL . http_build_query([
            'lat' => self::LAT,
            'lng' => self::LON,
            'date' => $dateStr,
            'formatted' => 0
        ]);

        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Mozilla/5.0 (compatible; SunriseProxy/1.0)'
            ]
        ]);

        $response = file_get_contents($url, false, $context);

        if ($response === false) {
            throw new Exception('Failed to fetch sunrise data from API');
        }

        $data = json_decode($response, true);

        if ($data === null || $data['status'] !== 'OK') {
            throw new Exception('Invalid response from sunrise API');
        }

        return $data['results'];
    }

    /**
     * Convert UTC time to Europe/Oslo timezone
     */
    private function convertToOsloTime($utcTimeStr) {
        if (empty($utcTimeStr)) {
            return null;
        }

        $utcTime = new DateTime($utcTimeStr, new DateTimeZone('UTC'));
        $utcTime->setTimezone($this->timezone);

        return $utcTime;
    }

    /**
     * Check if a time has already passed today
     */
    private function hasTimePassed($dateTime) {
        if ($dateTime === null) {
            return true;
        }

        $now = new DateTime('now', $this->timezone);
        return $dateTime < $now;
    }

    /**
     * Check if a time should be shown (within next 24 hours) or set to null
     */
    private function hasTimePassedForDate($dateTime, $targetDate = null) {
        if ($dateTime === null) {
            return true;
        }

        $now = new DateTime('now', $this->timezone);
        $next24Hours = clone $now;
        $next24Hours->add(new DateInterval('PT24H'));

        // If the event is in the past, return true (set to null)
        if ($dateTime < $now) {
            return true;
        }

        // If the event is more than 24 hours away, return true (set to null)
        if ($dateTime > $next24Hours) {
            return true;
        }

        return false;
    }

    /**
     * Get sunrise and sunset times for today
     */
    public function getSunTimes($date = null) {
        try {
            $sunData = $this->fetchSunData($date);

            $sunrise = $this->convertToOsloTime($sunData['sunrise']);
            $sunset = $this->convertToOsloTime($sunData['sunset']);

            // If times have passed, set to null
            $sunriseResult = $this->hasTimePassed($sunrise) ? null : $sunrise->format('H:i:s');
            $sunsetResult = $this->hasTimePassed($sunset) ? null : $sunset->format('H:i:s');

            return [
                'sunrise' => $sunriseResult,
                'sunset' => $sunsetResult,
                'date' => ($date ?: new DateTime('now', $this->timezone))->format('Y-m-d'),
                'timezone' => 'Europe/Oslo',
                'status' => 'success'
            ];

        } catch (Exception $e) {
            error_log("Sunrise API Error: " . $e->getMessage());
            return [
                'sunrise' => null,
                'sunset' => null,
                'date' => ($date ?: new DateTime('now', $this->timezone))->format('Y-m-d'),
                'timezone' => 'Europe/Oslo',
                'status' => 'error',
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Get sunrise and sunset times for a specific date with proper null handling
     */
    public function getSunTimesForDate($date) {
        try {
            $sunData = $this->fetchSunData($date);

            $sunrise = $this->convertToOsloTime($sunData['sunrise']);
            $sunset = $this->convertToOsloTime($sunData['sunset']);

            // Check if times have passed for this specific date
            $sunriseResult = $this->hasTimePassedForDate($sunrise, $date) ? null : $sunrise->format('H:i:s');
            $sunsetResult = $this->hasTimePassedForDate($sunset, $date) ? null : $sunset->format('H:i:s');

            return [
                'sunrise' => $sunriseResult,
                'sunset' => $sunsetResult,
                'date' => $date->format('Y-m-d')
            ];

        } catch (Exception $e) {
            error_log("Sunrise API Error for date " . $date->format('Y-m-d') . ": " . $e->getMessage());
            return [
                'sunrise' => null,
                'sunset' => null,
                'date' => $date->format('Y-m-d'),
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Get today's and tomorrow's sunrise/sunset data for frontend
     */
    public function getTodayAndTomorrowSunTimes() {
        $today = new DateTime('now', $this->timezone);
        $tomorrow = clone $today;
        $tomorrow->add(new DateInterval('P1D'));

        $todayData = $this->getSunTimesForDate($today);
        $tomorrowData = $this->getSunTimesForDate($tomorrow);

        return [
            'today' => $todayData,
            'tomorrow' => $tomorrowData,
            'timezone' => 'Europe/Oslo',
            'status' => 'success'
        ];
    }

    /**
     * Get all solar events within the next 24 hours
     */
    public function getAllUpcomingSolarEvents() {
        // Translation map for event types
        $eventLabels = [
            'sunrise' => 'Soloppgang',
            'sunset' => 'Solnedgang'
        ];

        $eventIcons = [
            'sunrise' => 'ikoner/sunrise.svg',
            'sunset' => 'ikoner/sunset.svg',
        ];

        $now = new DateTime('now', $this->timezone);
        $today = clone $now;
        $tomorrow = clone $now;
        $tomorrow->add(new DateInterval('P1D'));

        $events = [];

        try {
            // Get today's events
            $todayData = $this->fetchSunData($today);
            $todaySunrise = $this->convertToOsloTime($todayData['sunrise']);
            $todaySunset = $this->convertToOsloTime($todayData['sunset']);

            // Get tomorrow's events
            $tomorrowData = $this->fetchSunData($tomorrow);
            $tomorrowSunrise = $this->convertToOsloTime($tomorrowData['sunrise']);
            $tomorrowSunset = $this->convertToOsloTime($tomorrowData['sunset']);

            // Check today's events
            if ($todaySunrise && $todaySunrise > $now) {
                $events[] = [
                    'type' => 'sunrise',
                    'label' => $eventLabels['sunrise'],
                    'time' => $todaySunrise->format('H:i'),
                    'date' => $today->format('Y-m-d'),
                    'dayLabel' => 'I dag',
                    'datetime' => $todaySunrise,
                    'icon' => $eventIcons['sunrise'],
                ];
            }

            if ($todaySunset && $todaySunset > $now) {
                $events[] = [
                    'type' => 'sunset',
                    'label' => $eventLabels['sunset'],
                    'time' => $todaySunset->format('H:i'),
                    'date' => $today->format('Y-m-d'),
                    'dayLabel' => 'I dag',
                    'datetime' => $todaySunset,
                    'icon' => $eventIcons['sunset'],
                ];
            }

            // Check tomorrow's events (within 24 hours)
            $next24Hours = clone $now;
            $next24Hours->add(new DateInterval('PT24H'));

            if ($tomorrowSunrise && $tomorrowSunrise <= $next24Hours) {
                $events[] = [
                    'type' => 'sunrise',
                    'label' => $eventLabels['sunrise'],
                    'time' => $tomorrowSunrise->format('H:i'),
                    'date' => $tomorrow->format('Y-m-d'),
                    'dayLabel' => 'I morgen',
                    'datetime' => $tomorrowSunrise,
                    'icon' => $eventIcons['sunrise'],
                ];
            }

            if ($tomorrowSunset && $tomorrowSunset <= $next24Hours) {
                $events[] = [
                    'type' => 'sunset',
                    'label' => $eventLabels['sunset'],
                    'time' => $tomorrowSunset->format('H:i'),
                    'date' => $tomorrow->format('Y-m-d'),
                    'dayLabel' => 'I morgen',
                    'datetime' => $tomorrowSunset,
                    'icon' => $eventIcons['sunset'],
                ];
            }

            // Sort events by datetime
            usort($events, function($a, $b) {
                return $a['datetime'] <=> $b['datetime'];
            });

            // Remove datetime objects from final output (not JSON serializable)
            foreach ($events as &$event) {
                unset($event['datetime']);
            }

            return [
                'events' => $events,
                'timezone' => 'Europe/Oslo',
                'status' => 'success'
            ];

        } catch (Exception $e) {
            error_log("Solar events API Error: " . $e->getMessage());
            return [
                'events' => [],
                'timezone' => 'Europe/Oslo',
                'status' => 'error',
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Get only sunrise time
     */
    public function getSunrise($date = null) {
        $sunTimes = $this->getSunTimes($date);
        return [
            'sunrise' => $sunTimes['sunrise'],
            'date' => $sunTimes['date'],
            'timezone' => 'Europe/Oslo',
            'status' => $sunTimes['status']
        ];
    }

    /**
     * Get only sunset time
     */
    public function getSunset($date = null) {
        $sunTimes = $this->getSunTimes($date);
        return [
            'sunset' => $sunTimes['sunset'],
            'date' => $sunTimes['date'],
            'timezone' => 'Europe/Oslo',
            'status' => $sunTimes['status']
        ];
    }

    /**
     * Get all solar events for today and tomorrow
     */
    public function getAllEvents() {
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
            usort($allEvents, function($a, $b) {
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

    if ($type === 'all-events') {
        $result = $service->getAllEvents();
    } else {
        // Default: just get next event
        $result = $service->getAllEvents();
    }

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}

?>
