<?php
/**
 * AIS: Vessels in motion, fresh positions only, enriched with static info.
 */

header('Content-Type: application/json; charset=utf-8');

// ==== KONFIG ====
$rxLat     = 64.3278592;   // mottaker-lat
$rxLon     = 10.4155161;    // mottaker-lon
$maxKm     = 30;        // radius i kilometer (0 = ingen filter)
$minKn     = 2.0;       // terskel for "i bevegelse"
$maxAgeMin = 10;        // max alder på posisjon i minutter
$limitMmsi = 0;         // for testing (0 = alle)
// ================

// Ensure PRIVATE_PATH is available via the API bootstrap (defines PRIVATE_PATH)
require_once __DIR__ . '/../api/lib/bootstrap.php';

// Load credentials (outside webroot). Fail early with a clear JSON error if missing.
$credFile = rtrim(PRIVATE_PATH, '/\\') . '/konfigs.php';

include_once $credFile;

// Validate expected variables from credentials file
if (!isset($dbUser, $dbPass, $dbHost, $dbAis, $dbCharset)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'AIS credentials incomplete']);
    exit;
}

$options = [
  PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
  $dsn = "mysql:host=$dbHost;dbname=$dbAis;charset=$dbCharset";
  $pdo = new PDO($dsn, $dbUser, $dbPass, $options);

  // 1) MMSI fra "siste døgn"-tabellen
  $sqlMmsi = 'SELECT DISTINCT mmsi FROM stn_25002';
  if ($limitMmsi > 0) $sqlMmsi .= ' LIMIT ' . (int)$limitMmsi;
  $mmsis = $pdo->query($sqlMmsi)->fetchAll(PDO::FETCH_COLUMN, 0);
  if (!$mmsis) {
    echo json_encode([
      'receiver' => ['lat' => $rxLat, 'lon' => $rxLon],
      'radius_km'=> $maxKm,
      'count'    => 0,
      'vessels'  => [],
      'note'     => 'Ingen MMSI i stn_25002'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
  }

  // 2) Hent static-info for alle MMSI i én batch
  $staticMap = [];
  $chunks = array_chunk($mmsis, 1000);
  $sqlStaticBase = 'SELECT mmsi, name, callsign, ship_type, dest, eta, draught, tid AS static_tid
                    FROM static WHERE mmsi IN (';
  foreach ($chunks as $chunk) {
    $placeholders = implode(',', array_fill(0, count($chunk), '?'));
    $stmt = $pdo->prepare($sqlStaticBase . $placeholders . ')');
    foreach ($chunk as $i => $m) $stmt->bindValue($i+1, (int)$m, PDO::PARAM_INT);
    $stmt->execute();
    while ($r = $stmt->fetch()) {
      $staticMap[(int)$r['mmsi']] = [
        'name'      => $r['name'],
        'callsign'  => $r['callsign'],
        'ship_type' => $r['ship_type'] !== null ? (int)$r['ship_type'] : null,
        'dest'      => $r['dest'],
        'eta'       => $r['eta'],
        'draught'   => $r['draught'] !== null ? (int)$r['draught'] : null,
        'static_tid'=> $r['static_tid'],
      ];
    }
  }

  // Haversine (km)
  $haversineKm = function (float $lat1, float $lon1, float $lat2, float $lon2): float {
    $R = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat/2) ** 2
       + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2) ** 2;
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $R * $c;
  };

  $out = [];
  $ageInt = max(0, (int)$maxAgeMin); // brukes i INTERVAL literal

  foreach ($mmsis as $mmsi) {
    if (!preg_match('/^\d{9}$/', (string)$mmsi)) continue; // hvitlist tabellnavn
    $tbl = 'dyn_' . $mmsi;

    // 🔴 VIKTIG ENDRING:
    //   - Hent KUN SISTE RAD (ORDER BY tid DESC LIMIT 1)
    //   - INGEN speed-filter i SQL (vi sjekker speed ETTERPÅ)
    //   - behold ferskhetsfilter: hvis siste rad er eldre enn maxAgeMin, returnerer spørringen ingenting
    $sql = "SELECT tid, lat, lng, hdg, spd, cog, alt
            FROM `$tbl`
            WHERE lat IS NOT NULL
              AND lng IS NOT NULL
              AND tid >= (UTC_TIMESTAMP() - INTERVAL $ageInt MINUTE)
            ORDER BY tid DESC
            LIMIT 1";

    try {
      $row = $pdo->query($sql)->fetch();
      if (!$row) continue; // ikke fersk nok / ingen posisjon

      // ➕ Speed-sjekk PÅ DEN SISTE RADEN (strengt > 2 kn)
      if ($row['spd'] === null || (float)$row['spd'] <= $minKn) {
        continue;
      }

      $lat = (float)$row['lat'];
      $lon = (float)$row['lng'];
      $distKm = $haversineKm($rxLat, $rxLon, $lat, $lon);
      if ($maxKm > 0 && $distKm > $maxKm) continue;

      $s = $staticMap[(int)$mmsi] ?? null;

      $out[] = [
        'mmsi'       => (int)$mmsi,
        'name'       => $s['name']      ?? null,
        'callsign'   => $s['callsign']  ?? null,
        'ship_type'  => $s['ship_type'] ?? null,
        'dest'       => $s['dest']      ?? null,
        'eta'        => $s['eta']       ?? null,
        'draught_dm' => $s['draught']   ?? null,
        'static_tid' => $s['static_tid']?? null,

        'tid'        => $row['tid'],                // siste posisjonstid
        'lat'        => $lat,
        'lon'        => $lon,
        'spd_kn'     => round((float)$row['spd'], 2),
        'cog_deg'    => $row['cog'] !== null ? (int)$row['cog'] : null,
        'hdg_deg'    => $row['hdg'] !== null ? (int)$row['hdg'] : null,
        'alt'        => $row['alt'] !== null ? (int)$row['alt'] : null,

        'dist_km'    => round($distKm, 2),
        'dist_nm'    => round($distKm / 1.852, 2),
      ];
    } catch (Throwable $e) {
      continue; // f.eks. manglende dyn-tabell
    }
  }

  usort($out, fn($a, $b) => $a['dist_km'] <=> $b['dist_km']);

  echo json_encode([
    'receiver'     => ['lat' => $rxLat, 'lon' => $rxLon],
    'radius_km'    => $maxKm,
    'min_speed_kn' => $minKn,
    'max_age_min'  => $maxAgeMin,
    'count'        => count($out),
    'vessels'      => $out,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
