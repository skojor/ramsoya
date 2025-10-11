<?php
// Shim for backward-compatible endpoint name: /api/adsb.php
// Ensure bootstrap defaults are loaded so handlers can rely on constants like CACHE_TTL
require_once __DIR__ . '/lib/bootstrap.php';

$cwd = getcwd();
chdir(__DIR__ . '/handlers');
require __DIR__ . '/handlers/adsb.php';
chdir($cwd);
