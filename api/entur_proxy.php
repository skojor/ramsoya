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
    private const QUAY_SANDVIKS = "NSR:Quay:71233";

    // Legacy method for backward compatibility
    public function getDepartures($hours = 120) {
        return $this->getBidirectionalDepartures($hours);
    }

    public function getBidirectionalDepartures($hours = 120) {
        try {
            $stopRamsoy = $this->quayToStopPlace(self::QUAY_RAMSOY);
            $stopSandviks = $this->quayToStopPlace(self::QUAY_SANDVIKS);

            // Fetch departures from both stops with full journey data
            $boardRamsoy = $this->fetchBoardWithJourneys($stopRamsoy, $hours);
            $boardSandviks = $this->fetchBoardWithJourneys($stopSandviks, $hours);

            $departures = [];

            // Find next departure from Ramsøy to Sandviksberget with route verification
            $nextFromRamsoy = $this->findNextWithArrival($boardRamsoy, self::QUAY_SANDVIKS);
            if ($nextFromRamsoy) {
                $departures[] = [
                    'direction' => 'Fra Ramsøy → Sandviksberget',
                    'departure' => $nextFromRamsoy,
                    'verified' => true
                ];
            } else {
                // Fallback: planned departure with route verification
                $fallbackFromRamsoy = $this->findPlannedWithLeg($boardRamsoy, self::QUAY_SANDVIKS);
                if ($fallbackFromRamsoy) {
                    $departures[] = [
                        'direction' => 'Fra Ramsøy → Sandviksberget',
                        'departure' => $fallbackFromRamsoy,
                        'verified' => false,
                        'isFallback' => true
                    ];
                } else {
                    // Final fallback: just show next departure without route verification
                    $basicFromRamsoy = $this->findBasicUpcoming($boardRamsoy);
                    if ($basicFromRamsoy) {
                        $departures[] = [
                            'direction' => 'Fra Ramsøy → Sandviksberget',
                            'departure' => $basicFromRamsoy,
                            'verified' => false,
                            'isFallback' => true
                        ];
                    }
                }
            }

            // Find next departure from Sandviksberget to Ramsøy with route verification
            $nextFromSandviks = $this->findNextWithArrival($boardSandviks, self::QUAY_RAMSOY);
            if ($nextFromSandviks) {
                $departures[] = [
                    'direction' => 'Fra Sandviksberget → Ramsøy',
                    'departure' => $nextFromSandviks,
                    'verified' => true
                ];
            } else {
                // Fallback: planned departure with route verification
                $fallbackFromSandviks = $this->findPlannedWithLeg($boardSandviks, self::QUAY_RAMSOY);
                if ($fallbackFromSandviks) {
                    $departures[] = [
                        'direction' => 'Fra Sandviksberget → Ramsøy',
                        'departure' => $fallbackFromSandviks,
                        'verified' => false,
                        'isFallback' => true
                    ];
                } else {
                    // Final fallback: just show next departure without route verification
                    $basicFromSandviks = $this->findBasicUpcoming($boardSandviks);
                    if ($basicFromSandviks) {
                        $departures[] = [
                            'direction' => 'Fra Sandviksberget → Ramsøy',
                            'departure' => $basicFromSandviks,
                            'verified' => false,
                            'isFallback' => true
                        ];
                    }
                }
            }

            return [
                'success' => true,
                'data' => [
                    'bidirectionalDepartures' => $departures,
                    'stopRamsoyUrl' => $this->enturStopUrl($stopRamsoy),
                    'stopSandviksUrl' => $this->enturStopUrl($stopSandviks)
                ],
                'updated' => date('H:i')
            ];
        } catch (Exception $e) {
            error_log("Entur API error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'updated' => date('H:i')
            ];
        }
    }

    // Simple fallback to find any upcoming departure (matching production behavior)
    private function findBasicUpcoming($boardData) {
        $now = time();
        $calls = $boardData['calls'] ?? [];
        
        foreach ($calls as $call) {
            $depIso = $this->bestDep($call);
            if (!$depIso) continue;
            
            $depTime = strtotime($depIso);
            if ($depTime < $now) continue; // Only future departures
            
            return [
                'time' => $depIso,
                'destination' => $this->simplifyText($call['destinationDisplay']['frontText'] ?? ''),
                'onTimeStatus' => $this->deriveStatus($call),
                'mode' => $call['serviceJourney']['line']['transportMode'] ?? 'water',
                'verified' => false
            ];
        }
        
        return null;
    }

    // Find next departure that actually reaches the target quay by analyzing journey sequences
    private function findNextWithArrival($boardData, $targetQuay) {
        $now = time();
        $calls = $boardData['calls'] ?? [];

        foreach ($calls as $call) {
            $leg = $this->computeLegAfterLastOriginBeforeTarget($call, $targetQuay);
            if (!$leg) continue;

            $depTime = strtotime($leg['depIso']);
            if ($depTime < $now) continue; // Only future departures

            return [
                'time' => $leg['depIso'],
                'arrivalTime' => $leg['arrIso'],
                'destination' => $this->simplifyText($call['destinationDisplay']['frontText'] ?? ''),
                'onTimeStatus' => $this->deriveStatus($leg['depCallForStatus'] ?? $call),
                'mode' => $call['serviceJourney']['line']['transportMode'] ?? 'water',
                'verified' => true
            ];
        }

        return null;
    }

    // Find planned departure that verifies it reaches target via journey sequence
    private function findPlannedWithLeg($boardData, $targetQuay) {
        $now = time();
        $calls = $boardData['calls'] ?? [];

        foreach ($calls as $call) {
            $depIso = $this->bestDep($call);
            if (!$depIso || strtotime($depIso) < $now) continue;

            $originQuayId = $call['quay']['id'] ?? null;
            $leg = $this->computeLegAnyOriginBeforeTarget($call, $originQuayId, $targetQuay);
            if (!$leg) continue;

            return [
                'time' => $leg['depIso'],
                'arrivalTime' => $leg['arrIso'],
                'destination' => $this->simplifyText($call['destinationDisplay']['frontText'] ?? ''),
                'onTimeStatus' => $this->deriveStatus($leg['depCallForStatus'] ?? $call),
                'mode' => $call['serviceJourney']['line']['transportMode'] ?? 'water',
                'verified' => false,
                'fallbackNote' => 'bestillingstur'
            ];
        }

        return null;
    }

    // Compute leg from last origin before target (matching original complex logic)
    private function computeLegAfterLastOriginBeforeTarget($call, $targetQuay) {
        // Try datedServiceJourney first, then serviceJourney
        $seq = $call['datedServiceJourney']['estimatedCalls'] ??
               $call['serviceJourney']['estimatedCalls'] ?? [];

        if (empty($seq)) return null;

        $originQuayId = $call['quay']['id'] ?? null;
        if (!$originQuayId) return null;

        // Find target quay index
        $targetIdx = -1;
        foreach ($seq as $idx => $seqCall) {
            if (($seqCall['quay']['id'] ?? null) === $targetQuay) {
                $targetIdx = $idx;
                break;
            }
        }

        if ($targetIdx <= 0) return null;

        // Find last occurrence of origin before target
        $lastOriginIdx = -1;
        for ($i = $targetIdx - 1; $i >= 0; $i--) {
            if (($seq[$i]['quay']['id'] ?? null) === $originQuayId) {
                $lastOriginIdx = $i;
                break;
            }
        }

        if ($lastOriginIdx < 0) return null;

        $depIso = $this->bestDep($seq[$lastOriginIdx]);
        $arrIso = $this->bestArr($seq[$targetIdx]);

        if (!$depIso || !$arrIso) return null;

        // Validate timing
        if (strtotime($arrIso) <= strtotime($depIso)) return null;

        return [
            'depIso' => $depIso,
            'arrIso' => $arrIso,
            'depCallForStatus' => $seq[$lastOriginIdx]
        ];
    }

    // Compute leg for any origin before target (fallback logic)
    private function computeLegAnyOriginBeforeTarget($call, $originQuayId, $targetQuay) {
        $seq = $call['datedServiceJourney']['estimatedCalls'] ??
               $call['serviceJourney']['estimatedCalls'] ?? [];

        if (empty($seq)) return null;

        $targetIdx = -1;
        foreach ($seq as $idx => $seqCall) {
            if (($seqCall['quay']['id'] ?? null) === $targetQuay) {
                $targetIdx = $idx;
                break;
            }
        }

        if ($targetIdx <= 0) return null;

        $depIdx = -1;
        for ($i = $targetIdx - 1; $i >= 0; $i--) {
            if (($seq[$i]['quay']['id'] ?? null) === $originQuayId) {
                $depIdx = $i;
                break;
            }
        }

        if ($depIdx < 0) return null;

        $depIso = $this->bestDep($seq[$depIdx]);
        $arrIso = $this->bestArr($seq[$targetIdx]);

        if (!$depIso || !$arrIso) return null;
        if (strtotime($arrIso) <= strtotime($depIso)) return null;

        return [
            'depIso' => $depIso,
            'arrIso' => $arrIso,
            'depCallForStatus' => $seq[$depIdx]
        ];
    }

    // Get best departure time (actual > expected > aimed)
    private function bestDep($call) {
        return $call['actualDepartureTime'] ??
               $call['expectedDepartureTime'] ??
               $call['aimedDepartureTime'] ?? null;
    }

    // Get best arrival time (actual > expected > aimed)
    private function bestArr($call) {
        return $call['actualArrivalTime'] ??
               $call['expectedArrivalTime'] ??
               $call['aimedArrivalTime'] ?? null;
    }

    // Derive sophisticated status matching original logic
    private function deriveStatus($call) {
        if ($call['cancellation'] ?? false) {
            return "Kansellert";
        }

        $planned = $call['aimedDepartureTime'] ?? null;
        $live = $call['actualDepartureTime'] ??
                $call['expectedDepartureTime'] ??
                $planned;

        if (!$planned || !$live) {
            return "Planlagt";
        }

        $plannedTime = strtotime($planned);
        $liveTime = strtotime($live);

        if ($plannedTime === false || $liveTime === false) {
            return "Planlagt";
        }

        $delta = round(($liveTime - $plannedTime) / 60);

        if (abs($delta) >= 1) {
            $sign = $delta > 0 ? "+" : "";
            $status = $delta > 0 ? "Forsinket" : "Framskyndet";
            return "{$status} {$sign}{$delta} min";
        }

        if ($call['realtime'] ?? false) {
            return "I rute";
        }

        return "Planlagt";
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
                'timeout' => 10
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

    private function fetchBoardWithJourneys($stopPlaceId, $hours) {
        $startTime = date('c');

        // Enhanced query with full journey data for route analysis
        $query = '
        query ($id: String!, $start: DateTime!, $range: Int!, $n: Int!) {
          stopPlace(id: $id) {
            name
            estimatedCalls(
              startTime: $start
              timeRange: $range
              numberOfDepartures: $n
            ) {
              quay { id }
              realtime
              cancellation
              predictionInaccurate
              aimedDepartureTime
              expectedDepartureTime
              actualDepartureTime
              aimedArrivalTime
              expectedArrivalTime
              actualArrivalTime
              destinationDisplay { frontText }
              
              datedServiceJourney {
                id
                estimatedCalls {
                  quay { id }
                  realtime
                  cancellation
                  predictionInaccurate
                  aimedDepartureTime
                  expectedDepartureTime
                  actualDepartureTime
                  aimedArrivalTime
                  expectedArrivalTime
                  actualArrivalTime
                }
              }
              
              serviceJourney {
                id
                line { id publicCode name transportMode }
                estimatedCalls {
                  quay { id }
                  realtime
                  cancellation
                  predictionInaccurate
                  aimedDepartureTime
                  expectedDepartureTime
                  actualDepartureTime
                  aimedArrivalTime
                  expectedArrivalTime
                  actualArrivalTime
                }
              }
            }
          }
        }';

        $variables = [
            'id' => $stopPlaceId,
            'start' => $startTime,
            'range' => $hours * 3600,
            'n' => 120
        ];

        $data = $this->gql($query, $variables);

        return [
            'stopName' => $data['stopPlace']['name'] ?? 'Unknown',
            'calls' => $data['stopPlace']['estimatedCalls'] ?? []
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

// Check if bidirectional departures are requested
if (isset($_GET['bidirectional']) && $_GET['bidirectional'] === 'true') {
    error_log("Calling getBidirectionalDepartures");
    $result = $service->getBidirectionalDepartures();
} else {
    error_log("Calling getDepartures");
    $result = $service->getDepartures();
}

error_log("Outputting JSON result");
echo json_encode($result);
error_log("Script completed");
