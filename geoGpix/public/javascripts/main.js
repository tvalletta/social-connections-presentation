var socket = io.connect(window.location.origin);

socket.on('initfile', function(data){
   console.log(data);
    var img = new Image();
    img.onload = function(){
        $("#pics").prepend(img);
    }
    img.src = data.img;
});

//When asked for position, get position and emit back
socket.on("position",function(){
    navigator.geolocation.getCurrentPosition(function(p){
        if(p){
            socket.emit("position", p);
        }
    });
});


$(document).ready(function(){


    var picker = $("#picker");
    picker.on("change", function(e){
        if(e.target.files){
            var file = e.target.files[0];
            var reader = new FileReader();
            reader.onload = processFile;
            var url = reader.readAsDataURL(file);
            picker.value = ""
        }else{
            picker.value = "";
        }
    });

});

function processFile(){
    var can = document.createElement('canvas'),
        con = can.getContext("2d");
    var img = new Image();
    img.onload = function(){
        var w, h;
        if(img.width > img.height){
            w = 200,
            h = Math.floor(200 * (img.height/img.width));
        }else{
            h = 200,
            w = Math.floor(200 * (img.width/img.height));
        }
        can.width = w,
        can.height = h;
        con.drawImage(img, 0, 0, w, h);
        url = can.toDataURL("png", 0.2);
        if(url){
            navigator.geolocation.getCurrentPosition(function(position){
                socket.emit("hazfile", {'img':url, 'pos':position});
            });
        }

    }
    img.src = this.result;
    $("#pics").append(can);

}