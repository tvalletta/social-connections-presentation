

var express = require('express')
  , fs = require("fs")
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , iolib = require("socket.io")
  , server
  , io
  , wrench = require("wrench");



var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);

server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

//SOCKET SECTION
io = iolib.listen(server);
//io.configure(function () {
//    io.set("transports", ["xhr-polling"]);
//    io.set("polling duration", 10);
//});

var conns = [];
io.sockets.on('connection', function (socket) {

    conns.push(socket);
    socket.emit("position",{});
    socket.on("position",function(data){
        sendDownPics(socket, data);
    });
    socket.on("hazfile", function(data){
        saveFile(data, socket);
    });
});

function saveFile(data, socket){

    if(data.pos){

        var d = data.img.replace(/^data:image\/png;base64,/, "");
        var buf = new Buffer(d, 'base64');
        var lat = ""+Math.round(data.pos.coords.latitude);
        var lon = ""+Math.round(data.pos.coords.longitude);
        lat = lat.replace(/\-/g,"neg");
        lon = lon.replace(/\-/g,"neg");
        var folder = __dirname+"/public/uploads/"+lat+"/"+lon;
        wrench.mkdirSyncRecursive(folder, 0777);
        var fileName = folder+"/"+ new Date().getTime()+".png"
        fs.writeFile(fileName , buf, "base64", function(){
            fs.readFile(fileName, 'base64', function(e, d){
//                socket.broadcast.send("initfile",{"img":"data:image/png;base64,"+d});
                conns.forEach(function(conn){
                    if(conn.id != socket.id)
                        conn.emit("initfile",{"img":"data:image/png;base64,"+d});
                });
            });
        });

//        conns.forEach(function(conn){
//            if(conn.id != socket.id)
//                conn.emit("initfile",{"img":"data:image/png;base64,"+data.img});
//        });

    }

}

function sendDownPics(s, data){
    if(data.coords){


        var lat = ""+Math.round(data.coords.latitude);
        var lon = ""+Math.round(data.coords.longitude);
        lat = lat.replace(/\-/g,"neg");
        lon = lon.replace(/\-/g,"neg");
        var folder = __dirname+"/public/uploads/"+lat+"/"+lon;

        fs.readdir(folder, function(e, files){
            if(files){
//            console.log(files.length, __dirname+"/public/uploads/"+Math.round(data.pos.coords.latitude)+"/"+Math.round(data.pos.coords.longitude));
                files.forEach(function(file){
                    fs.readFile(folder+"/"+file, 'base64', function(e, d){
                        s.emit("initfile",{"img":"data:image/png;base64,"+d});
                    });
                });
            }

        });
    }

}




function slocDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    return Math.acos(Math.sin(lat1) * Math.sin(lat2) +
        Math.cos(lat1) * Math.cos(lat2) *
            Math.cos(lon2 - lon1)) * R;
}
