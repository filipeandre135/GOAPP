var lat = 0;
var lng = 0;
var movSense = 0.000015;
var checkpoint;
var leftlimit = 8.439156, toplimit = 41.562733, bottomlimit = 41.541536, rightlimit = 8.393742;
var args;


self.addEventListener("message", function (e) {
    args = e.data;
    lat = args[0];
    lng = args[1];
}, false);

function GoToCheckpoint() {
    if (typeof args != 'undefined') {
        if (typeof checkpoint == 'undefined' || (Math.abs(lat - checkpoint[0]) < movSense && Math.abs(lng - checkpoint[1]) < movSense)) {
            var RandomLatitude = (Math.random() * (toplimit - bottomlimit) + bottomlimit).toFixed(6);
            var RandomLongitude = (Math.random() * (leftlimit - rightlimit) + rightlimit).toFixed(6);
            checkpoint = [RandomLatitude, RandomLongitude * (-1)];
        }
        if (lat < checkpoint[0]) {
            lat += movSense;
        }
        if (lat > checkpoint[0]) {
            lat -= movSense;
        }
        if (lng > checkpoint[1]) {
            lng -= movSense;
        }
        if (lng < checkpoint[1]) {
            lng += movSense;
        }
        postMessage([lat, lng]);
    }
    setTimeout("GoToCheckpoint()", 1000);
}

GoToCheckpoint();