<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Default location (Ramsøya)
$default_lat = 64.33;
$default_lon = 10.41;
$default_radius = 100; // km

// Get parameters
$center_lat = isset($_GET['lat']) ? floatval($_GET['lat']) : $default_lat;
$center_lon = isset($_GET['lon']) ? floatval($_GET['lon']) : $default_lon;
$radius_km = isset($_GET['radius']) ? floatval($_GET['radius']) : $default_radius;
$max_age = isset($_GET['max_age']) ? intval($_GET['max_age']) : 60; // seconds

// Airline mapping - comprehensive list from original JavaScript code
$airline_map = [
    // IATA codes
    'SK' => 'Scandinavian Airlines (SAS)',
    'DY' => 'Norwegian',
    'WF' => 'Widerøe',
    'KL' => 'KLM',
    'LH' => 'Lufthansa',
    'BA' => 'British Airways',
    'FR' => 'Ryanair',
    'W6' => 'Wizz Air',
    'AF' => 'Air France',
    'AY' => 'Finnair',
    'BT' => 'airBaltic',
    'SU' => 'Aeroflot',
    'TK' => 'Turkish Airlines',
    'LX' => 'SWISS',
    'OS' => 'Austrian',
    'SN' => 'Brussels Airlines',
    'IB' => 'Iberia',
    'VY' => 'Vueling',
    'LO' => 'LOT Polish Airlines',
    'AZ' => 'ITA Airways',
    'EZY' => 'easyJet', // ICAO-style code sometimes seen in callsign
    'U2' => 'easyJet',

    // ICAO codes
    'SAS' => 'Scandinavian Airlines',
    'NAX' => 'Norwegian Air Shuttle',
    'WIF' => 'Widerøe',
    'KLM' => 'KLM',
    'DLH' => 'Lufthansa',
    'BAW' => 'British Airways',
    'RYR' => 'Ryanair',
    'AFR' => 'Air France',
    'FIN' => 'Finnair',
    'BTI' => 'airBaltic',
    'THY' => 'Turkish Airlines',
    'SWR' => 'SWISS',
    'AUA' => 'Austrian',
    'IBE' => 'Iberia',
    'VLG' => 'Vueling',
    'LOT' => 'LOT Polish Airlines',
    'ITY' => 'ITA Airways',
    'NOZ' => 'Norwegian',
    'NSZ' => 'Norwegian'
];

/**
 * Calculate distance between two points using Haversine formula
 */
function haversine_km($lat1, $lon1, $lat2, $lon2) {
    $R = 6371; // Earth radius in km
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $lat1_rad = deg2rad($lat1);
    $lat2_rad = deg2rad($lat2);

    $h = sin($dLat/2) * sin($dLat/2) +
         cos($lat1_rad) * cos($lat2_rad) *
         sin($dLon/2) * sin($dLon/2);

    return 2 * $R * asin(sqrt($h));
}

/**
 * Convert km to nautical miles
 */
function km_to_nm($km) {
    return $km / 1.852;
}

/**
 * Derive airline from flight code
 */
function derive_airline($flight) {
    global $airline_map;

    if (empty($flight)) return null;

    // Normalize flight code by removing possible suffixes (e.g., /A, .L, etc.)
    $normalized_flight = preg_replace('/[\/.].*/', '', $flight);

    // Try 3-letter code first
    $code3 = substr($normalized_flight, 0, 3);
    if (isset($airline_map[$code3])) {
        return $airline_map[$code3];
    }

    // Try 2-letter code
    $code2 = substr($normalized_flight, 0, 2);
    if (isset($airline_map[$code2])) {
        return $airline_map[$code2];
    }

    return null;
}

try {
    // Determine the base URL dynamically
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $base_url = $protocol . '://' . $host;

    // Allow override via environment variable or GET parameter
    if (isset($_ENV['ADSB_BASE_URL'])) {
        $base_url = $_ENV['ADSB_BASE_URL'];
    } elseif (isset($_GET['adsb_url'])) {
        $base_url = $_GET['adsb_url'];
    }

    // Construct the full aircraft data URL
    $aircraft_url = rtrim($base_url, '/') . '/adsb/tar1090/data/aircraft.json';

    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'user_agent' => 'Ramsoya ADS-B Proxy',
            'method' => 'GET',
            'header' => [
                'Accept: application/json',
                'Cache-Control: no-cache'
            ]
        ]
    ]);

    $json_data = file_get_contents($aircraft_url, false, $context);
    if ($json_data === false) {
        throw new Exception('Failed to fetch aircraft data from: ' . $aircraft_url);
    }

    $data = json_decode($json_data, true);
    if (!$data || !isset($data['aircraft'])) {
        throw new Exception('Invalid aircraft data format');
    }

    $current_time = time();
    $filtered_aircraft = [];

    foreach ($data['aircraft'] as $aircraft) {
        // Skip if no position data
        if (!isset($aircraft['lat']) || !isset($aircraft['lon'])) {
            continue;
        }

        // Check data age
        if (isset($aircraft['seen_pos']) && $aircraft['seen_pos'] > $max_age) {
            continue;
        }

        // Calculate distance
        $distance_km = haversine_km($center_lat, $center_lon, $aircraft['lat'], $aircraft['lon']);

        // Filter by radius
        if ($distance_km > $radius_km) {
            continue;
        }
        // Enrich aircraft data
        $enriched_aircraft = $aircraft;
        $enriched_aircraft['distance_km'] = (float)number_format($distance_km, 1, '.', '');
        $enriched_aircraft['distance_nm'] = (float)number_format(km_to_nm($distance_km), 1, '.', '');

        // Add airline info if flight code exists
        if (isset($aircraft['flight']) && !empty(trim($aircraft['flight']))) {
            $airline = derive_airline(trim($aircraft['flight']));
            if ($airline) {
                $enriched_aircraft['airline'] = $airline;
            }
        }

        // Add relative bearing (could be enhanced further)
        if (isset($aircraft['track'])) {
            $enriched_aircraft['track_deg'] = $aircraft['track'];
        }

        // Add last seen timestamp (tid) for frontend
        if (isset($aircraft['seen']) && is_numeric($aircraft['seen'])) {
            $enriched_aircraft['tid'] = $current_time - $aircraft['seen'];
        } elseif (isset($aircraft['seen_pos']) && is_numeric($aircraft['seen_pos'])) {
            $enriched_aircraft['tid'] = $current_time - $aircraft['seen_pos'];
        }

        $filtered_aircraft[] = $enriched_aircraft;
    }

    // Sort by distance (closest first)
    usort($filtered_aircraft, function($a, $b) {
        return $a['distance_km'] <=> $b['distance_km'];
    });

    // Prepare response
    $response = [
        'success' => true,
        'timestamp' => $current_time,
        'center' => [
            'lat' => $center_lat,
            'lon' => $center_lon
        ],
        'radius_km' => $radius_km,
        'aircraft_count' => count($filtered_aircraft),
        'aircraft' => $filtered_aircraft,
        'raw_count' => count($data['aircraft'])
    ];

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => time()
    ]);
}
?>
