<?php
// Ensure PRIVATE_PATH is defined by the API bootstrap
require_once __DIR__ . '/../api/lib/bootstrap.php';
require_once rtrim(PRIVATE_PATH, '/\\') . '/konfigs.php';

// --- HTTP-headers ---
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
ini_set('display_errors', 0);
error_reporting(E_ERROR);

// --- Input ---
$debug    = isset($_GET['debug']);
$range    = $_GET['range']   ?? null;
$startStr = $_GET['start']   ?? null;
$endStr   = $_GET['end']     ?? null;
$interval = strtolower($_GET['interval'] ?? '10m');
$agg      = strtolower($_GET['agg'] ?? 'avg');
$fieldsQ  = $_GET['fields']  ?? 'temp,wtemp,wind_strength,wind_gust';
$tzParam  = $_GET['tz']      ?? 'Europe/Oslo';

// --- Normaliser intervall (godta både "10m" og "10min") ---
$normInt = [
  '5'  => 300,  '5m'  => 300,  '5min'  => 300,
  '10' => 600,  '10m' => 600,  '10min' => 600,
  '15' => 900,  '15m' => 900,  '15min' => 900,
  '30' => 1800, '30m' => 1800, '30min' => 1800,
  '1h' => 3600, '60m' => 3600,
  '3h' => 10800,
  '6h' => 21600,
];
$step = $normInt[$interval] ?? 600; // default 10 min

$allowedAgg = ['avg'=>'AVG','min'=>'MIN','max'=>'MAX'];
$aggSql = $allowedAgg[$agg] ?? 'AVG';

// Felter
$allCols = [
  'temp' => 'temp',
  'wtemp' => 'wtemp',
  'wind_strength' => 'wind_strength',
  'wind_gust' => 'wind_gust'
];
$req = array_map('trim', explode(',', strtolower($fieldsQ)));
$fields = [];
foreach ($req as $k) if (isset($allCols[$k])) $fields[] = $allCols[$k];
if (!$fields) $fields = ['temp','wtemp','wind_strength','wind_gust'];

// --- Tidssone og tidsrom ---
try {
  $tz = new DateTimeZone($tzParam);
} catch(Throwable $e) {
  $tz = new DateTimeZone('Europe/Oslo');
}

$now = new DateTimeImmutable('now', $tz);

if ($range) {
  if (!preg_match('/^(\d+)([hdm])$/i', $range, $m)) {
    echo json_encode(['error'=>'Ugyldig range. Bruk f.eks. 24h, 7d, 1m', 'debug'=>['got'=>$range]]);
    exit;
  }
  $n=(int)$m[1]; $u=strtolower($m[2]);
  $endDT   = $now;
  $startDT = $u==='h' ? $now->modify("-{$n} hours")
          : ($u==='d' ? $now->modify("-{$n} days") : $now->modify("-{$n} months"));
} else {
  $endDT   = $endStr   ? new DateTimeImmutable($endStr, $tz)   : $now;
  $startDT = $startStr ? new DateTimeImmutable($startStr, $tz) : $endDT->modify('-24 hours');
}

// vern: maks 1 år
if ($startDT < $now->modify('-1 year')) $startDT = $now->modify('-1 year');

$startSQL = $startDT->format('Y-m-d H:i:s');
$endSQL   = $endDT->format('Y-m-d H:i:s');

// --- DB ---
try {
  $pdo = new PDO(
    "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4",
    $dbUser, $dbPass,
    [ PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC ]
  );

  // Hent serverens NOW() og time_zone til debug
  $serverNow = $pdo->query("SELECT NOW() AS now_val, @@session.time_zone AS tz")->fetch();

  // Bucket og SELECT
  $bucketExpr = "FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(datotid)/:step)*:step)";
  $selectCols = ["{$bucketExpr} AS t"];
  foreach ($fields as $col) {
    $alias = ($col === 'wind_strength') ? 'wind' : ($col === 'wind_gust' ? 'gust' : $col);
    $selectCols[] = "{$aggSql}({$col}) AS {$alias}";
  }
  $selectSQL = implode(", ", $selectCols);

  $sql = "
    SELECT
      {$selectSQL}
    FROM {$table}
    WHERE datotid BETWEEN :start AND :end
    GROUP BY t
    ORDER BY t ASC
  ";
  $stmt = $pdo->prepare($sql);
  $stmt->bindValue(':step',  $step, PDO::PARAM_INT);
  $stmt->bindValue(':start', $startSQL);
  $stmt->bindValue(':end',   $endSQL);
  $stmt->execute();
  $rows = $stmt->fetchAll();

  // Legg med en kjapp COUNT for diagnose når rows=0
  $stmt2 = $pdo->prepare("SELECT COUNT(*) AS cnt FROM {$table} WHERE datotid BETWEEN :s AND :e");
  $stmt2->execute([':s'=>$startSQL, ':e'=>$endSQL]);
  $cntOnly = $stmt2->fetchColumn();

  $out = [
    'meta' => [
      'table'    => $table,
      'start'    => $startSQL,
      'end'      => $endSQL,
      'interval' => $interval,
      'agg'      => $agg,
      'fields'   => $fields,
      'points'   => count($rows)
    ],
    'rows' => $rows
  ];

  if ($debug) {
    $out['debug'] = [
      'server_now' => $serverNow['now_val'] ?? null,
      'server_tz'  => $serverNow['tz'] ?? null,
      'php_now'    => $now->format('Y-m-d H:i:s') . ' ' . $tz->getName(),
      'count_between' => (int)$cntOnly,
      'step_seconds'  => $step,
      'bucket_expr'   => $bucketExpr,
      'sql_preview'   => $sql
    ];
  }

  echo json_encode($out, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;

} catch (Throwable $e) {
  http_response_code(500);
  $err = ['error'=>'Serverfeil'];
  if ($debug) $err['detail'] = $e->getMessage();
  echo json_encode($err);
  exit;
}
