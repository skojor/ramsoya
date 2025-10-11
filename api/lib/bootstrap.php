<?php

if (!defined('PRIVATE_PATH')) {
    // 2) env override
    $env = getenv('PRIVATE_PATH');
    if ($env && $env !== '') {
        $path = $env;
    } else {
        // 3) prefer DOCUMENT_ROOT when present and looks sane
        $path = null;
        if (!empty($_SERVER['DOCUMENT_ROOT'])) {
            $docroot = realpath($_SERVER['DOCUMENT_ROOT']);
            if ($docroot !== false && is_dir($docroot)) {
                $candidate = dirname($docroot) . DIRECTORY_SEPARATOR . 'private';
                $path = realpath($candidate) ?: $candidate;
            }
        }

        if ($path === null) {
            $candidate = realpath(__DIR__ . '/../../../private') ?: __DIR__ . '/../../../private';
            $path = $candidate;
        }
    }
    define('PRIVATE_PATH', $path);
}

// Lightweight bootstrap for API handlers: define safe defaults if private config is absent.
if (!defined('CACHE_TTL')) {
    define('CACHE_TTL', 15 * 60); // 15 minutes default
}
if (!defined('APP_NAME')) {
    define('APP_NAME', 'ramsoya');
}
if (!defined('CONTACT')) {
    define('CONTACT', 'noreply@example.com');
}
// Set a sensible default timezone if not set
if (!ini_get('date.timezone')) {
    date_default_timezone_set('Europe/Oslo');
}
