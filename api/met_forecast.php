<?php
// Shim for /api/met_forecast.php -> handlers/met_forecast.php
// Ensure bootstrap defaults are loaded so handlers can rely on constants like CACHE_TTL
require_once __DIR__ . '/lib/bootstrap.php';

$cwd = getcwd();
chdir(__DIR__ . '/handlers');
require __DIR__ . '/handlers/met_forecast.php';
chdir($cwd);
