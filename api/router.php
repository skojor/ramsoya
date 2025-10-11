<?php
// Simple router for /api/* requests.
// Maps friendly paths to handler files in this directory or the handlers/ subdirectory.

header('Content-Type: application/json; charset=utf-8');
// Allow CORS for the frontend
header('Access-Control-Allow-Origin: *');

// Load bootstrap defaults (CACHE_TTL, APP_NAME, CONTACT) so handlers don't error
require_once __DIR__ . '/lib/bootstrap.php';

$baseDir = __DIR__;
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';

// Remove query string and leading /api/ prefix
$path = parse_url($uri, PHP_URL_PATH);
$path = preg_replace('#^' . preg_quote(dirname($scriptName), '#') . '#', '', $path);
$path = preg_replace('#^/api#', '', $path);
$path = trim($path, '/');

// If empty, show a small index of available endpoints
$available = [
    'adsb' => 'adsb.php',
    'entur' => 'entur.php',
    'image_metadata' => 'image_metadata.php',
    'kartverket' => 'kartverket.php',
    'met_forecast' => 'met_forecast.php',
    'met_moon' => 'met_moon.php',
    'sunrise' => 'sunrise.php',
];

if ($path === '' || $path === 'router.php') {
    echo json_encode(["api" => "ramsoya", "version" => "1", "endpoints" => $available], JSON_PRETTY_PRINT);
    exit;
}

$basename = basename($path);
$basenameNoQuery = preg_replace('/\?.*$/', '', $basename);

// Remove trailing .php if present
$key = preg_replace('/\.php$/', '', $basenameNoQuery);

if (isset($available[$key])) {
    $targetFile = $baseDir . '/' . $available[$key];
} else {
    // Also support handlers/ subdir
    if (file_exists($baseDir . '/handlers/' . $basenameNoQuery)) {
        $targetFile = $baseDir . '/handlers/' . $basenameNoQuery;
    } else {
        // Maybe request used the actual filename
        if (file_exists($baseDir . '/' . $basenameNoQuery)) {
            $targetFile = $baseDir . '/' . $basenameNoQuery;
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Endpoint not found', 'requested' => $path]);
            exit;
        }
    }
}

// Security: ensure target is inside api directory
$realBase = realpath($baseDir);
$realTarget = realpath($targetFile);
if ($realTarget === false || strpos($realTarget, $realBase) !== 0) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

// Execute the target script while preserving its expected CWD so relative requires keep working
$cwd = getcwd();
chdir(dirname($realTarget));
// Use require so included script can send headers and output directly
require $realTarget;
chdir($cwd);

exit;
