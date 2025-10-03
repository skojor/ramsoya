<?php
// Add error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, must-revalidate');

// Debug: Start
error_log("Starting Entur API script");

class EnturService {
    private const CLIENT_NAME = "ramsoy-index-prod";
    private const GRAPHQL_URL = "https://api.entur.io/journey-planner/v3/graphql";
    private const QUAY_RAMSOY = "NSR:Quay:71232";

    public function getDepartures($hours = 120) {
        error_log("getDepartures called");
        try {
            error_log("Converting quay to stop place");
            $stopPlaceId = $this->quayToStopPlace(self::QUAY_RAMSOY);
            error_log("Stop place ID: " . $stopPlaceId);

            error_log("Fetching board data");
            $data = $this->fetchBoard($stopPlaceId, $hours);
            error_log("Board data fetched successfully");

            return [
                'success' => true,
                'data' => $data,
                'updated' => date('H:i')
            ];
        } catch (Exception $e) {
            error_log("Error in getDepartures: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'updated' => date('H:i')
            ];
        }
    }

    private function gql($query, $variables = []) {
        error_log("Making GraphQL request to: " . self::GRAPHQL_URL);

        $payload = json_encode([
            'query' => $query,
            'variables' => $variables
        ]);

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => [
                    'Content-Type: application/json',
                    'ET-Client-Name: ' . self::CLIENT_NAME
                ],
                'content' => $payload,
                'timeout' => 10  // Add timeout
            ]
        ]);

        error_log("About to make file_get_contents call");
        $response = file_get_contents(self::GRAPHQL_URL, false, $context);

        if ($response === false) {
            error_log("GraphQL request failed - no response");
            throw new Exception('GraphQL request failed - no response received');
        }

        error_log("GraphQL response received, length: " . strlen($response));

        $data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("JSON decode error: " . json_last_error_msg());
            throw new Exception('Invalid JSON response from GraphQL API');
        }

        if (isset($data['errors'])) {
            $errorMsg = implode('; ', array_column($data['errors'], 'message'));
            error_log("GraphQL errors: " . $errorMsg);
            throw new Exception($errorMsg);
        }

        return $data['data'];
    }

    private function quayToStopPlace($id) {
        if (strpos($id, 'NSR:StopPlace:') === 0) {
            return $id;
        }
        if (strpos($id, 'NSR:Quay:') === 0) {
            $query = 'query ($id: String!) { quay(id: $id) { stopPlace { id } } }';
            $data = $this->gql($query, ['id' => $id]);
            return $data['quay']['stopPlace']['id'] ?? $id;
        }
        return $id;
    }

    private function fetchBoard($stopPlaceId, $hours) {
        $startTime = date('c');

        $query = '
        query ($id: String!, $start: DateTime!) {
          stopPlace(id: $id) {
            name
            estimatedCalls(
              startTime: $start
              timeRange: 432000
              numberOfDepartures: 50
            ) {
              realtime
              aimedDepartureTime
              expectedDepartureTime
              destinationDisplay { frontText }
              serviceJourney {
                id
                line { id publicCode name transportMode }
              }
            }
          }
        }';

        $variables = [
            'id' => $stopPlaceId,
            'start' => $startTime
        ];

        $data = $this->gql($query, $variables);

        $departures = [];
        $calls = $data['stopPlace']['estimatedCalls'] ?? [];

        foreach ($calls as $call) {
            $departure = [
                'time' => $call['expectedDepartureTime'] ?? $call['aimedDepartureTime'],
                'destination' => $this->simplifyText($call['destinationDisplay']['frontText'] ?? ''),
                'realtime' => $call['realtime'] ?? false,
                'line' => $call['serviceJourney']['line']['publicCode'] ?? '',
                'mode' => $call['serviceJourney']['line']['transportMode'] ?? 'water'
            ];

            if (strtotime($departure['time']) > time()) {
                $departures[] = $departure;
            }
        }

        usort($departures, function($a, $b) {
            return strtotime($a['time']) <=> strtotime($b['time']);
        });

        return [
            'stopName' => $data['stopPlace']['name'] ?? 'Ramsøy',
            'departures' => array_slice($departures, 0, 5),
            'stopPlaceUrl' => $this->enturStopUrl($stopPlaceId)
        ];
    }

    private function simplifyText($text) {
        return preg_replace('/\s+via\s+.*/i', '', $text);
    }

    private function enturStopUrl($stopPlaceId) {
        return "https://entur.no/nearby-stop-place-detail?id=" . urlencode($stopPlaceId);
    }
}

error_log("Creating service instance");
$service = new EnturService();
error_log("Calling getDepartures");
$result = $service->getDepartures();
error_log("Outputting JSON result");
echo json_encode($result);
error_log("Script completed");
?>
