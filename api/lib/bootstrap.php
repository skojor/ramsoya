<?php

if (!defined('PRIVATE_PATH')) {
    // 2) env override
    $env = getenv('PRIVATE_PATH');
    if ($env && $env !== '' && is_dir($env)) {
        $path = realpath($env);
    } else {
        // 3) prefer DOCUMENT_ROOT when present and looks sane
        $path = null;
        if (!empty($_SERVER['DOCUMENT_ROOT'])) {
            $docroot = realpath($_SERVER['DOCUMENT_ROOT']);
            if ($docroot !== false && is_dir($docroot)) {
                $candidate = dirname($docroot) . DIRECTORY_SEPARATOR . 'private';
                if (is_dir($candidate)) {
                    $path = realpath($candidate);
                }
            }
        }

        if ($path === null) {
            $candidate = realpath(__DIR__ . '/../../../private') ?: __DIR__ . '/../../../private';
            // Prefer realpath if it exists, otherwise use candidate (best-effort)
            $path = is_dir($candidate) ? realpath($candidate) : $candidate;
        }
    }
    define('PRIVATE_PATH', $path);
}

// Helper to require files from the private directory with clear error handling
if (!function_exists('require_private')) {
    function require_private(string $filename): void
    {
        $file = rtrim(PRIVATE_PATH, '/\\') . '/' . ltrim($filename, '/\\');
        if (!is_file($file) || !is_readable($file)) {
            // If running in CLI or headers already sent, throw exception; otherwise send JSON 500
            if (php_sapi_name() === 'cli' || headers_sent()) {
                throw new RuntimeException("Missing private file: $file");
            }
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Missing private configuration', 'expected' => $file], JSON_UNESCAPED_UNICODE);
            exit;
        }
        require $file;
    }
}

// Lightweight bootstrap for API handlers: define safe defaults if private config is absent.
if (!defined('CACHE_TTL')) {
    define('CACHE_TTL', 15 * 60); // 15 minutes default
}
if (!defined('APP_NAME')) {
    define('APP_NAME', 'Ramsøyværet');
}
if (!defined('CONTACT')) {
    define('CONTACT', 'post@iship.no');
}
// Set a sensible default timezone if not set
if (!ini_get('date.timezone')) {
    date_default_timezone_set('Europe/Oslo');
}
