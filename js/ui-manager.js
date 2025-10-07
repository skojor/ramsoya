// Status pill updates
function updateStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    // ... status update logic
}

// Weather overlay toggle
function toggleWeatherOverlay() {
    const overlay = document.getElementById('weatherOverlay');
    // ... overlay toggle logic
}

// Button event handlers for time range selection
document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', handleRangeChange);
});

// Window beforeunload cleanup
window.addEventListener("beforeunload", () => {
    clearInterval(imgTimer);
    clearInterval(weatherTimer);
    clearInterval(statusTimer);
    clearInterval(moonTimer);
    clearInterval(fcTimer);
    clearInterval(sunTimer);
});

