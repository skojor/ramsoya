<?php
// Shim for /api/image_metadata.php -> handlers/image_metadata.php
// Ensure bootstrap defaults are loaded so handlers can rely on constants like CACHE_TTL
require_once __DIR__ . '/lib/bootstrap.php';

$cwd = getcwd();
chdir(__DIR__ . '/handlers');
require __DIR__ . '/handlers/image_metadata.php';
chdir($cwd);
