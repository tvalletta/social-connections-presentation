var express = require('express'),
    io = require('socket.io');

var app = express(),
    server = require('http').createServer(app),
    io = io.listen(server);

io.set('log level', 1);
server.listen(3000);
app.use("/", express.static(__dirname + '/static'));

var unmatched = [],
    remove = [];

function match(time, pos, socket) {
    var isMatch = false;
    for (var i = 0; i < unmatched.length; i++) {
        var candidate = unmatched[i];
        if (+new Date() - candidate.time > 2000) {
            remove.push(i);
            continue;
        }
        console.log('time: ' + time + ' - cTime: ' + candidate.time + ' = ' + (time - candidate.time));
        if (Math.abs(time - candidate.time) < 200) {
            var dist = slocDistance(
                pos.coords.latitude,
                pos.coords.longitude,
                candidate.pos.coords.latitude,
                candidate.pos.coords.longitude
            );
            if (dist < 3) {
                isMatch = true;
                success(socket, candidate.socket);
            }
        }
    }

    for (i = remove.length - 1; i >= 0; i--) {
        unmatched.splice(remove[i], 1);
        console.log('removing: [' + remove[i] + ']');
    }
    remove = [];

    if (!isMatch) {
        unmatched.push({time: time, pos: pos, socket: socket});
        console.log('added to unmatched');
    }
}

function success(socket1, socket2) {
    var random = Math.round(Math.random() * 10000);
    socket1.emit("match", {id: random});
    socket2.emit("match", {id: random});
}

function slocDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    return Math.acos(Math.sin(lat1) * Math.sin(lat2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.cos(lon2 - lon1)) * R;
}

function average(array) {
    var sum = 0;
    for (var i = 0; i < array.length; i++) {
        sum += array[i];
    }
    return sum / array.length;
}

function variance(array, avg) {
    var v = 0;
    for (var i = 0; i < array.length; i++) {
        v += Math.pow((array[i] - avg), 2 );
    }
    return v / array.length;
}

function standardDev(vrc) {
    return Math.sqrt(vrc);
}

// -----------------------------------------------------------------------
// On a socket connection
// -----------------------------------------------------------------------
io.sockets.on('connection', function(socket) {
    var clientTimestamps = new Array(6),
        serverTimestamps = new Array(6),
        position,
        firstContact,
        avgLatency;
    
    socket.on('position', function(data) {
        var time = +new Date() - avgLatency - data.elapsed;
        match(time, data.pos, this);
    });

    socket.on('timestamp', function(data) {
        var now = +new Date(),
            pingPongId = data.id;
        if (!firstContact) firstContact = now;

        // Initialize Timestamp Arrays for PingPong ID
        if (!clientTimestamps[pingPongId])
            clientTimestamps[pingPongId] = [];
        if (!serverTimestamps[pingPongId])
            serverTimestamps[pingPongId] = [];
        
        // Push the timestamp data into the appropriate arrays
        clientTimestamps[pingPongId].push(data.ct);
        serverTimestamps[pingPongId].push(now);

        // If we have less than three client values send it back
        if (clientTimestamps[pingPongId].length < 3) {
            socket.emit('timestamp', {id: pingPongId});
        }
        else {
            stop(pingPongId);
        }
    });

    var cnt = 0;
    function stop(id) {
        if (++cnt === 6) {
            avgLatency = calcAverageLatency();
            reset();
        }
    }

    function reset() {
        clientTimestamps = new Array(6);
        serverTimestamps = new Array(6);
        firstContact = false;
    }

    function calcAverageLatency() {
        var roundTrips = [],
            i;

        for (i = 0; i < clientTimestamps.length; i++) {
            pushRoundTrips(clientTimestamps[i], roundTrips);
        }
        for (i = 0; i < serverTimestamps.length; i++) {
            pushRoundTrips(serverTimestamps[i], roundTrips);
        }

        var avg = average(roundTrips),
            vrnc = variance(roundTrips, avg),
            stdD = standardDev(avg);

        var remove = [];
        for (i = 0; i < roundTrips.length; i++) {
            if (roundTrips[i] > (avg + stdD)) {
                remove.push(i);
            }
        }
        for (i = remove.length; i >= 0; i--) {
            roundTrips.splice(remove[i - 1], 1);
        }
        return Math.round(average(roundTrips) / 2);
    }

    function pushRoundTrips(array, roundTrips) {
        for (var i = 1; i < array.length; i++) {
            roundTrips.push(array[i] - array[i - 1]);
        }
    }

});