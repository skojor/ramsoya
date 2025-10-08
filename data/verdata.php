<?php
require("../../private/konfigs.php");

// --- HTTP-headers ---
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
ini_set('display_errors', 0);
error_reporting(E_ERROR);

function parse_db_version($s) {
  $isMaria = stripos($s, 'mariadb') !== false;
  $maj=$min=$pat=0;
  if (preg_match('/(\d+)\.(\d+)\.(\d+)/', $s, $m)) {
    $maj=(int)$m[1]; $min=(int)$m[2]; $pat=(int)$m[3];
  }
  return [$isMaria,$maj,$min,$pat];
}

try {
  // --- Input ---
  $debug     = isset($_GET['debug']) ? (int)$_GET['debug'] : 0;
  $tzParam   = $_GET['tz']     ?? 'Europe/Oslo';
  $fieldsQ   = $_GET['fields'] ?? 'temp,wind_strength,wind_gust';
  $agg       = strtolower($_GET['agg'] ?? 'avg'); // avg|min|max
  $interval  = $_GET['interval'] ?? '10m';        // 5m, 10m, 1h, 3h, 6h, 30m, 15m
  $range     = $_GET['range'] ?? null;            // e.g. 24h, 7d, 1m
  $startQ    = $_GET['start'] ?? null;            // ISO-like
  $endQ      = $_GET['end']   ?? null;
  $useCTE    = isset($_GET['use_cte']) ? (int)$_GET['use_cte'] : null; // null=auto, 0=force php, 1=force cte

  // --- Tillatte felt ---
  $allCols = [
    'temp'           => 'temp',
    'wtemp'          => 'wtemp',
    'wind_strength'  => 'wind_strength',
    'wind_gust'      => 'wind_gust',
    'humidity'       => 'humidity'
  ];
  $req = array_filter(array_map('trim', explode(',', strtolower($fieldsQ))));
  $fields = [];
  foreach ($req as $k) if (isset($allCols[$k])) $fields[] = $allCols[$k];
  if (!$fields) $fields = ['temp','wind_strength','wind_gust'];

  // --- Aggregeringsfunksjon ---
  $aggFn = [
    'avg' => 'AVG',
    'min' => 'MIN',
    'max' => 'MAX'
  ][$agg] ?? 'AVG';

  // --- Tidsone ---
  try { $tz = new DateTimeZone($tzParam); } catch (Throwable $e) { $tz = new DateTimeZone('Europe/Oslo'); }
  $now = new DateTimeImmutable('now', $tz);

  // --- Intervall-normalisering ---
  $normInt = [
    '5'  => 300,  '5m'  => 300,  '5min' => 300,
    '10' => 600,  '10m' => 600,  '10min'=> 600,
    '15' => 900,  '15m' => 900,  '15min'=> 900,
    '30' => 1800, '30m' => 1800, '30min'=> 1800,
    '1h' => 3600, '60m' => 3600,
    '3h' => 10800,
    '6h' => 21600
  ];
  $interval = strtolower($interval);
  if (!isset($normInt[$interval])) {
    echo json_encode(['error'=>'Ugyldig interval. Bruk f.eks. 10m, 1h, 3h'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $step = (int)$normInt[$interval];

  // --- Bestem start og slutt ---
  if ($range) {
    if (!preg_match('/^(\d+)([hdm])$/i', $range, $m)) {
      echo json_encode(['error'=>'Ugyldig range. Bruk f.eks. 24h, 7d, 1m', 'debug'=>$range], JSON_UNESCAPED_UNICODE);
      exit;
    }
    $n = (int)$m[1]; $u = strtolower($m[2]);
    $endDT = $now;
    $startDT = $u==='h' ? $now->modify("-{$n} hours")
              : ($u==='d' ? $now->modify("-{$n} days") : $now->modify("-{$n} months"));
  } else {
    try {
      $startDT = $startQ ? new DateTimeImmutable($startQ, $tz) : $now->modify('-24 hours');
      $endDT   = $endQ   ? new DateTimeImmutable($endQ,   $tz) : $now;
    } catch (Throwable $e) {
      echo json_encode(['error'=>'Ugyldig start/end'], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }
  $startSQL = $startDT->format('Y-m-d H:i:s');
  $endSQL   = $endDT->format('Y-m-d H:i:s');

  // Forhåndsberegn antall bøtter
  $bucketCount = (int)floor(($endDT->getTimestamp() - $startDT->getTimestamp()) / $step) + 1;

  // --- DB ---
  $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
  ]);
  $verStr = $pdo->query("SELECT VERSION()")->fetchColumn();
  [$isMaria,$maj,$min,$pat] = parse_db_version($verStr);

  // alias (wind_strength->wind, wind_gust->gust)
  $aliases = [];
  foreach ($fields as $col) $aliases[$col] = ($col === 'wind_strength') ? 'wind' : (($col === 'wind_gust') ? 'gust' : $col);

  // Agg alle kolonner (vi subsetter senere)
  $allAggCols = ['temp','wtemp','wind_strength','wind_gust','humidity'];
  $aggColsSQL = [];
  foreach ($allAggCols as $col) {
    $alias = ($col === 'wind_strength') ? 'wind' : (($col === 'wind_gust') ? 'gust' : $col);
    $aggColsSQL[] = "{$aggFn}(`{$col}`) AS `{$alias}`";
  }
  $aggColsSQL = implode(",\n    ", $aggColsSQL);
  $finalCols = [];
  foreach ($fields as $col) $finalCols[] = "agg.`{$aliases[$col]}`";
  $finalColsSQL = implode(",\n  ", $finalCols);

  // Beslutning om metode
  $cteSupported = $isMaria ? ($maj>10 || ($maj==10 && $min>=2)) : ($maj>=8);
  $maxSafe = 900; // under default cte_max_recursion_depth=1000
  $method = 'php_fill'; // default
  if ($cteSupported) {
    if ($useCTE===1 && $bucketCount <= $maxSafe) $method = 'cte';
    elseif ($useCTE===0) $method = 'php_fill';
    elseif ($useCTE===null && $bucketCount <= $maxSafe) $method = 'cte';
  }

  if ($method === 'cte') {
    // MariaDB krever ofte eksplisitt kolonneliste i CTE (vi har én kolonne: epoch)
    $sql = "
WITH RECURSIVE ts (epoch) AS (
  SELECT FLOOR(UNIX_TIMESTAMP(:start)/:step)*:step
  UNION ALL
  SELECT ts.epoch + :step FROM ts
  WHERE ts.epoch + :step <= UNIX_TIMESTAMP(:end)
),
src AS (
  SELECT datotid, temp, wtemp, wind_strength, wind_gust, humidity FROM `la3lja1`
  WHERE datotid BETWEEN :start AND :end
  UNION ALL
  SELECT datotid, temp, NULL AS wtemp, wind_strength, wind_gust, NULL AS humidity FROM `la3lja3`
  WHERE datotid BETWEEN :start AND :end
),
agg AS (
  SELECT
    FLOOR(UNIX_TIMESTAMP(datotid)/:step)*:step AS epoch,
    {$aggColsSQL}
  FROM src
  GROUP BY epoch
)
SELECT
  FROM_UNIXTIME(ts.epoch) AS t,
  {$finalColsSQL}
FROM ts
LEFT JOIN agg ON agg.epoch = ts.epoch
ORDER BY t ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':start', $startSQL);
    $stmt->bindValue(':end',   $endSQL);
    $stmt->bindValue(':step',  $step, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();
  } else {
    // Fallback uten CTE: aggregér per bøtte og fyll i PHP
    $bucketExpr = "FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(datotid)/:step)*:step)";
    $srcSQL = "
      SELECT datotid, temp, wtemp, wind_strength, wind_gust, humidity FROM `la3lja1`
      WHERE datotid BETWEEN :start AND :end
      UNION ALL
      SELECT datotid, temp, NULL AS wtemp, wind_strength, wind_gust, NULL AS humidity FROM `la3lja3`
      WHERE datotid BETWEEN :start AND :end
    ";
    $sql = "
      SELECT
        {$bucketExpr} AS t,
        {$aggFn}(temp) AS temp,
        {$aggFn}(wtemp) AS wtemp,
        {$aggFn}(wind_strength) AS wind,
        {$aggFn}(wind_gust) AS gust,
        {$aggFn}(humidity) AS humidity
      FROM ( {$srcSQL} ) AS src
      GROUP BY t
      ORDER BY t ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':start', $startSQL);
    $stmt->bindValue(':end',   $endSQL);
    $stmt->bindValue(':step',  $step, PDO::PARAM_INT);
    $stmt->execute();
    $fetched = $stmt->fetchAll();

    // Fyll hull i PHP
    $map = [];
    foreach ($fetched as $r) $map[$r['t']] = $r;
    $wantAliases = [];
    foreach ($fields as $c) $wantAliases[] = $aliases[$c];
    $rows = [];
// --- ALIGN TIL BØTTEGRENSER (viktig!) ---
$startEpoch = floor(strtotime($startSQL) / $step) * $step;
// Ta med siste bøtte helt ut til nærmeste step-grense:
$endEpoch   = floor(strtotime($endSQL)   / $step) * $step;

// Start/stop som DateTime i riktig tidssone
$cur = (new DateTimeImmutable('@' . $startEpoch))->setTimezone($tz);
$end = (new DateTimeImmutable('@' . $endEpoch))->setTimezone($tz);

    while ($cur <= $end) {
      $key = $cur->format('Y-m-d H:i:s');
      if (isset($map[$key])) {
        $row = ['t'=>$key];
        foreach ($wantAliases as $a) $row[$a] = $map[$key][$a];
        $rows[] = $row;
      } else {
        $row = ['t'=>$key];
        foreach ($wantAliases as $a) $row[$a] = null;
        $rows[] = $row;
      }
      $cur = $cur->modify("+{$step} seconds");
    }
  }

  $out = [
    'meta' => [
      'mariadb'  => $isMaria,
      'db_ver'   => $verStr,
      'method'   => $method,
      'buckets'  => $bucketCount,
      'start'    => $startSQL,
      'end'      => $endSQL,
      'interval' => $interval,
      'step_sec' => $step,
      'agg'      => $agg,
      'fields'   => array_values($fields),
      'aliases'  => $aliases,
      'points'   => count($rows)
    ],
    'rows' => $rows
  ];
  if ($debug) $out['debug'] = ['sql_preview'=>$sql];

  echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;

} catch (Throwable $e) {
  http_response_code(500);
  $err = ['error'=>'Serverfeil'];
  if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
  // Alltid vis detalj når debug=1
  if (isset($_GET['debug']) && (int)$_GET['debug'] === 1) {
    $err['detail'] = $e->getMessage();
    $err['trace']  = $e->getTraceAsString();
  }
  echo json_encode($err, JSON_UNESCAPED_UNICODE);
  exit;
}
