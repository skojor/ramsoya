;(() => {
    // m/s -> kn
    const msToKn = (ms) => ms * 1.943844;

    // Vindbarb: fjær i hale (x0), pilspiss i nese (x1)
    function windBarbSVG(speedMS, dirDeg) {
        const kn = msToKn(speedMS || 0);
        const rounded = Math.round(kn / 5) * 5;
        let remain = rounded;

        const pennants = Math.floor(remain / 50);
        remain %= 50;
        const fulls = Math.floor(remain / 10);
        remain %= 10;
        const halves = remain >= 5 ? 1 : 0;

        // Geometri
        const x0 = 8, x1 = 40;   // stang: hale -> nese
        const y = 24;
        const step = 4;
        const barbLenFull = 12;
        const barbLenHalf = 0.55 * barbLenFull;
        const barbAngle = -50 * Math.PI / 180;

        const parts = [];
        // Stang
        parts.push('<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>');

        // Fjær i HALEN (x0)
        let x = x0;
        for (let i = 0; i < pennants; i++) {
            const xb = x;
            x += step;
            const xTip = xb - barbLenFull * Math.cos(barbAngle);
            const yTip = y + barbLenFull * Math.sin(barbAngle);
            parts.push('<polygon points="' + xb + ',' + y + ' ' + xTip + ',' + yTip + ' ' + xb + ',' + (y - 1) + '" fill="currentColor"/>');
        }
        for (let i = 0; i < fulls; i++) {
            const xb = x;
            x += step;
            const xEnd = xb - barbLenFull * Math.cos(barbAngle);
            const yEnd = y + barbLenFull * Math.sin(barbAngle);
            parts.push('<line x1="' + xb + '" y1="' + y + '" x2="' + xEnd + '" y2="' + yEnd + '" stroke="currentColor" stroke-width="2"/>');
        }
        if (halves) {
            const xb = x;
            x += step;
            const xEnd = xb - barbLenHalf * Math.cos(barbAngle);
            const yEnd = y + barbLenHalf * Math.sin(barbAngle);
            parts.push('<line x1="' + xb + '" y1="' + y + '" x2="' + xEnd + '" y2="' + yEnd + '" stroke="currentColor" stroke-width="2"/>');
        }

        // Pilspiss i NESA (x1)
        parts.push('<polygon points="' + x1 + ',' + y + ' ' + (x1 - 6) + ',' + (y - 4) + ' ' + (x1 - 6) + ',' + (y + 4) + '" fill="currentColor"/>');

        // Rotasjon: FROM-retning. Sett window.WIND_FLIP=true for 180° snu
        const flip = window.WIND_FLIP === true;
        let rot = (dirDeg ?? 0) - 90;
        if (flip) rot += 180;

        // Stabil rotasjon rundt (24,24) med <g transform>
        return '<svg class="wind-barb" viewBox="0 0 48 48" role="img" aria-label="Vind ' + Math.round(kn) + ' kn, retning ' + Math.round(dirDeg) + '°">'
            + '<g transform="rotate(' + rot + ' 24 24)">' + parts.join('') + '</g>'
            + '</svg>';
    }

    // Eksponer globalt
    window.windBarbSVG = windBarbSVG;
    // Default: ikke snu. Sett window.WIND_FLIP = true senere for 180°
    if (window.WIND_FLIP === undefined) window.WIND_FLIP = false;
})();