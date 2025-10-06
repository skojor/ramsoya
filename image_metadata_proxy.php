<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');

$imageUrl = 'siste.jpg';

// Get headers from the image
$headers = get_headers($imageUrl, 1);

if ($headers && isset($headers['Last-Modified'])) {
    echo json_encode([
        'lastModified' => $headers['Last-Modified'],
        'success' => true
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Could not fetch image headers',
        'success' => false
    ]);
}
?>
