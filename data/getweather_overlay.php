<?php
declare(strict_types=1);

require("../../private/weathercred.php");

// ---------- HJELPEFUNKSJONER ----------
function wdir_to_text(?int $deg): ?string {
    if ($deg === null) return null;
    $dirs = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'];
    $idx = (int) floor((($deg % 360) + 360) % 360 / 45 + 0.5) % 8;
    return $dirs[$idx];
}

function fmt_num(?float $v, int $dec = 1): ?string {
    if ($v === null) return null;
    return number_format($v, $dec, '.', '');
}

/** Avgjør antall desimaler for vindverdier gitt vindkast-regelen */
function fmt_wind(?float $v, ?float $gust): ?string {
    if ($v === null) return null;
    $dec = ($gust !== null && $gust >= 10.0) ? 0 : 1;
    return fmt_num($v, $dec);
}

function join_nonempty(array $parts, string $sep = ' - '): string {
    $out = array_values(array_filter($parts, fn($p) => $p !== null && $p !== '' ));
    return implode($sep, $out);
}

function header_json(): void {
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
}

/** Beaufort-betegnelse på norsk basert på middelvind i m/s */
function beaufort_label(?float $mps): ?string {
    if ($mps === null) return null;
    $v = $mps;
    if ($v < 0.3) return 'stille';
    if ($v < 1.6) return 'flau vind';
    if ($v < 3.4) return 'svak vind';
    if ($v < 5.5) return 'lett bris';
    if ($v < 8.0) return 'laber bris';
    if ($v < 10.8) return 'frisk bris';
    if ($v < 13.9) return 'liten kuling';
    if ($v < 17.2) return 'stiv kuling';
    if ($v < 20.8) return 'sterk kuling';
    if ($v < 24.5) return 'liten storm';
    if ($v < 28.5) return 'full storm';
    if ($v < 32.7) return 'sterk storm';
    return 'orkan';
}

function fetch_latest(PDO $pdo, string $table, string $label, bool $raw = false): array {
    $stmt = $pdo->query("SELECT * FROM `$table` ORDER BY `datotid` DESC LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return ['label' => $label, 'data' => $raw ? null : ["Ingen data"]];

    if ($raw) {
        return ['label' => $label, 'data' => $row];
    }

    $wdeg = isset($row['wind_direction']) ? (int)$row['wind_direction'] : null;
    $wdir = wdir_to_text($wdeg);
    $wspd = isset($row['wind_strength']) ? (float)$row['wind_strength'] : null;
    $wgst = isset($row['wind_gust']) ? (float)$row['wind_gust'] : null;

    $temp = isset($row['temp']) ? (float)$row['temp'] : null;
    $hum  = isset($row['humidity']) ? (float)$row['humidity'] : null;
    $baro = isset($row['barometer']) ? (float)$row['barometer'] : null;

    $rsm  = isset($row['rain_sm']) ? (float)$row['rain_sm'] : null;

    $wtemp= isset($row['wtemp']) ? (float)$row['wtemp'] : null;
    $tide = isset($row['tide']) ? (float)$row['tide'] : null;
    $wave = isset($row['wave']) ? (float)$row['wave'] : null;
    $wper = isset($row['wavePeriod']) ? (float)$row['wavePeriod'] : null;

    $wind_label = beaufort_label($wspd);
    $wspd_txt = fmt_wind($wspd, $wgst);
    $wgst_txt = ($wgst !== null) ? fmt_wind($wgst, $wgst) : null;

    // Linje 1
    $line1_parts = [];
    if ($temp !== null) $line1_parts[] = fmt_num($temp, 1) . " °C";
    if ($hum  !== null) $line1_parts[] = "luftfuktighet " . fmt_num($hum, 0) . "%";

    $vind = [];
    // Vindretning bare for Brygga
    if ($label !== 'Liafjellet') {
        if ($wdir !== null) $vind[] = $wdir;
        if ($wdeg !== null) $vind[] = $wdeg . "°";
    }
    if ($wspd_txt !== null) $vind[] = $wspd_txt . " m/s";
    if ($wgst_txt !== null) $vind[] = "(kast " . $wgst_txt . ")";
    if ($wind_label !== null) $vind[] = "– " . $wind_label;

    if (!empty($vind)) $line1_parts[] = implode(' ', $vind);
    $line1 = join_nonempty($line1_parts);

    // Linje 2
    $line2_parts = [];
    if ($rsm !== null) $line2_parts[] = "regn siden midnatt " . fmt_num($rsm, 1) . " mm";
    if ($baro !== null) $line2_parts[] = "barometer " . fmt_num($baro, 0) . " hPa";
    $line2 = join_nonempty($line2_parts);

    // Linje 3 (uten tidsstempel)
    $line3_parts = [];
    if ($wtemp !== null) $line3_parts[] = "sjøtemp. " . fmt_num($wtemp, 1) . " °C";
    if ($tide  !== null) $line3_parts[] = "tide " . fmt_num($tide, 2) . " m";
    if ($wave  !== null) {
        $wp = "bølge " . fmt_num($wave, 1) . " m";
        if ($wper !== null) $wp .= " (" . fmt_num($wper, 1) . " s)";
        $line3_parts[] = $wp;
    }
    $line3 = join_nonempty($line3_parts);

    $lines = array_values(array_filter([
        $line1 ?: null,
        $line2 ?: null,
        $line3 ?: null
    ]));

    if (empty($lines)) $lines = ["Ingen gyldige felt i siste måling"];

    return ['label' => $label, 'data' => $lines];
}

// ---------- HOVED ----------
try {
    $dsn = "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=$DB_CHARSET";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $raw = isset($_GET['raw']);
    $result = [];
    foreach ($SOURCES as $table => $label) {
        $result[] = fetch_latest($pdo, $table, $label, $raw);
    }

    header_json();
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    header_json();
    echo json_encode(["Feil ved henting av data"], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
