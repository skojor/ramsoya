<?php
// Ensure bootstrap defaults are loaded so handler can rely on constants like CACHE_TTL
require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/HttpClient.php';

use Ramsoya\Api\Lib\HttpClient;

header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');

// Allow override via environment variable for local testing
$baseOverride = $_ENV['IMAGE_BASE_URL'] ?? null;
if ($baseOverride) {
    $imageUrl = rtrim($baseOverride, '/') . '/siste.jpg';
} else {
    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $imageUrl = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/siste.jpg';
}

// Use HttpClient::head to fetch headers
$resp = HttpClient::head($imageUrl, ['User-Agent: RamsoyaImageProbe/1.0'], 8);
if ($resp['error']) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Could not fetch image headers: ' . $resp['error'],
        'success' => false
    ]);
    exit;
}

$lastModified = null;
foreach ($resp['headers'] as $h) {
    if (stripos($h, 'Last-Modified:') === 0) {
        $lastModified = trim(substr($h, strlen('Last-Modified:')));
        break;
    }
}

if ($lastModified) {
    echo json_encode([
        'lastModified' => $lastModified,
        'success' => true
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Could not fetch image headers',
        'success' => false
    ]);
}
