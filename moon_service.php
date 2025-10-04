<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, must-revalidate');

class MoonPhaseService {
    private const MOON_API_URL = "https://api.met.no/weatherapi/sunrise/3.0/moon";
    private const CLIENT_NAME = "ramsoy-index-prod";

    public function getMoonPhase($lat = 64.33, $lon = 10.41) {
        try {
            $data = $this->fetchMoonData($lat, $lon);
            $moonphase = $this->extractMoonphase($data);

            if ($moonphase === null || !is_numeric($moonphase)) {
                throw new Exception('Could not find valid moonphase data');
            }

            $degree = fmod(fmod(floatval($moonphase), 360) + 360, 360);
            $phaseName = $this->getPhaseName($degree);
            $illumination = $this->getIlluminationFraction($degree);
            $svg = $this->generateMoonSVG($degree);

            return [
                'success' => true,
                'data' => [
                    'degree' => round($degree, 2),
                    'phaseName' => $phaseName,
                    'illumination' => round($illumination * 100),
                    'svg' => $svg,
                    'text' => $phaseName . ' • ' . round($illumination * 100) . '%'
                ],
                'updated' => date('H:i')
            ];
        } catch (Exception $e) {
            error_log("Moon API error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'updated' => date('H:i')
            ];
        }
    }

    private function fetchMoonData($lat, $lon) {
        $url = self::MOON_API_URL . "?lat={$lat}&lon={$lon}";

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => [
                    'User-Agent: ' . self::CLIENT_NAME,
                    'Accept: application/json'
                ],
                'timeout' => 10
            ]
        ]);

        $response = file_get_contents($url, false, $context);
        if ($response === false) {
            throw new Exception('Failed to fetch moon data from MET API');
        }

        $data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response from MET API');
        }

        return $data;
    }

    private function extractMoonphase($data) {
        // Recursively search for moonphase data in the response
        return $this->deepFindMoonphase($data);
    }

    private function deepFindMoonphase($obj) {
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
                $found = $this->deepFindMoonphase($value);
                if ($found !== null && is_numeric($found)) {
                    return $found;
                }
            }
        }

        return null;
    }

    private function getPhaseName($degree) {
        $d = fmod($degree + 360, 360);

        if ($d < 10 || $d >= 350) return "Nymåne";
        if (abs($d - 90) < 10) return "Første kvarter";
        if (abs($d - 180) < 10) return "Fullmåne";
        if (abs($d - 270) < 10) return "Siste kvarter";

        return $d < 180 ? "Voksende" : "Minkende";
    }

    private function getIlluminationFraction($degree) {
        return (1 - cos(deg2rad($degree))) / 2;
    }

    private function generateMoonSVG($degree) {
        $size = 120;
        $r = $size / 2;
        $cx = $r;
        $cy = $r;
        $phi = deg2rad($degree);
        $rx = abs(cos($phi)) * $r;

        // Generate points for the lit portion
        $points = $this->generateMoonPoints($degree, $size, $r, $cx, $cy, $rx);

        $pathData = $this->pointsToPath($points);

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

    private function generateMoonPoints($degree, $size, $r, $cx, $cy, $rx) {
        $N = 64;
        $halfN = (int)($N / 2); // Explicitly cast to int to avoid deprecation warning
        $points = [];

        if ($degree <= 180) {
            // Waxing phase
            $points = array_merge($points, $this->sampleCircle(-M_PI/2, M_PI/2, $cx, $cy, $r, $halfN));
            if ($degree <= 90) {
                $points = array_merge($points, $this->sampleEllipse(M_PI/2, -M_PI/2, $cx, $cy, $rx, $r, $halfN, 'right'));
            } else {
                $points = array_merge($points, $this->sampleEllipse(M_PI/2, -M_PI/2, $cx, $cy, $rx, $r, $halfN, 'left'));
            }
        } else {
            // Waning phase
            $points = array_merge($points, $this->sampleCircle(M_PI/2, 3*M_PI/2, $cx, $cy, $r, $halfN));
            if ($degree <= 270) {
                $points = array_merge($points, $this->sampleEllipse(-M_PI/2, M_PI/2, $cx, $cy, $rx, $r, $halfN, 'right'));
            } else {
                $points = array_merge($points, $this->sampleEllipse(-M_PI/2, M_PI/2, $cx, $cy, $rx, $r, $halfN, 'left'));
            }
        }

        return $points;
    }

    private function sampleCircle($from, $to, $cx, $cy, $r, $n) {
        $points = [];
        $n = (int)$n; // Ensure $n is an integer
        for ($i = 0; $i <= $n; $i++) {
            $t = $from + ($to - $from) * ($i / $n);
            $points[] = [$cx + $r * cos($t), $cy + $r * sin($t)];
        }
        return $points;
    }

    private function sampleEllipse($from, $to, $cx, $cy, $rx, $ry, $n, $side) {
        $points = [];
        $n = (int)$n; // Ensure $n is an integer
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

    private function pointsToPath($points) {
        if (empty($points)) return '';

        $path = 'M' . round($points[0][0], 3) . ',' . round($points[0][1], 3);
        for ($i = 1; $i < count($points); $i++) {
            $path .= 'L' . round($points[$i][0], 3) . ',' . round($points[$i][1], 3);
        }
        $path .= 'Z';

        return $path;
    }
}

// Handle request
$lat = isset($_GET['lat']) ? floatval($_GET['lat']) : 64.33;
$lon = isset($_GET['lon']) ? floatval($_GET['lon']) : 10.41;

$service = new MoonPhaseService();
echo json_encode($service->getMoonPhase($lat, $lon));
?>
