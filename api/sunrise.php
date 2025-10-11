<?php
// Shim for /api/sunrise.php -> handlers/sunrise.php
// Ensure bootstrap defaults are loaded so handlers can rely on constants like CACHE_TTL
require_once __DIR__ . '/lib/bootstrap.php';

$cwd = getcwd();
chdir(__DIR__ . '/handlers');
require __DIR__ . '/handlers/sunrise.php';
chdir($cwd);
