var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io").listen(server);

//Array of rooms, will be removed from list once they are full
var randomRooms = [];
var privateRooms = [];



server.listen(process.env.PORT || 4000);
console.log("running");
console.log("Listening port 4000.");

app.use(express.static('.'));

//Send main html file
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
  
//Send style file
app.get('/style.css', function(req, res){
    res.sendFile(__dirname + '/style.css');
});
  
//send script file
app.get('/script.js', function(req, res){
    res.sendFile(__dirname + '/script.js');
});

//Array of users
var currentUsers = [];
var connectionsMade = 0;

//When user connects
io.on("connection", function(socket) {
  connectionsMade += 1;
  getBrowserCookie(socket);       //Get cookie if any
  updateRooms();                  //Update rooms in case some were made but then people left

  socket.on("disconnect", function() {
    //console.log("user disconnected");
  });

  //If opponent won then tell them they won and leave the room
  socket.on("opponent won", function(roomId){
    socket.to(roomId).emit("You win");
    socket.leave(roomId);
  });

  //If tie then tell opponent it is a tie and then leave room
  socket.on("we tied", function(roomId){
    socket.to(roomId).emit("game tie");
    socket.leave(roomId);
  });

  //Leave room and update room array if game is over
  socket.on("game over", function(roomId){
    socket.leave(roomId);
    updateRooms();
  });

  //If move made tell user it is no longer their turn and tell other user in room
  //that it is their turn, giving them the row and column of move that was just made
  socket.on("move made", function(data){
    socket.emit("not my turn");
    //console.log(""+data.moveRow+data.moveCol);
    socket.to(data.roomId).emit("your turn",{
      movecol: data.moveCol,
      moverow: data.moveRow
    });
  });

  //Tell opponent that they will have first move and tell self it is not owns turn
  socket.on("you start", function(roomId){
    socket.emit("not my turn");
    socket.to(roomId).emit("You go first");
  });

  //Create a private room
  socket.on("create room", function(roomId){
    socket.join(roomId);
    //console.log(roomId);
    privateRooms.push(roomId);
    socket.emit("room made",roomId);  //Tell user room was made.
  });

  //Function for joing private room
  socket.on("join private", function(data){
    var roomId = data.roomCode;
    //Check if roomCode is existing room and if it is join it and remove from arry of private rooms
    for(var i=0;i< privateRooms.length;i++){
      if(privateRooms[i] == roomId){
        privateRooms.splice(i,1);
        socket.join(roomId);
        socket.to(roomId).emit("someone joined", data.username);
        return;
      }
    }
    //Otherwise tell them it is a room that doesn't exist or is full.
    socket.emit("invalid room");
  });

  //Give acknowledgement to user that they joined
  socket.on("reply to join", function(data){
    socket.to(data.roomCode).emit("reply recieve", {
      opponent: data.username,
      roomId: data.roomCode
    });
  });

  //Send cookie info to script so that it can store it in currentUserInfo
  socket.on("send browser cookie", function(username) {
    //console.log(username);
    if(username !== null){
      let usernameParts = username.split("@#$%");
      let nameFromParts = usernameParts[0];
      for (var i = 0; i < currentUsers.length; i++) {
        let userListParts = currentUsers[i].username.split("@#$%");
        let userListName = userListParts[0];
        if (userListName == nameFromParts) {
          socket.emit("show username", { username: currentUsers[i].username });
          return;
        }
      }
    }

    // If browser doesn't have a cookie new connection
    var usernameInProgress = "";
    //Generate random username from parts array
    // for (part of parts) {
    //   usernameInProgress += part[Math.floor(Math.random() * part.length)];
    // }
    
    //Add default theme as 1 at the end of the username
    var newUsername = usernameInProgress.concat("@#$%1");
    //console.log("new = "+ newUsername);
    //console.log(newUsername);
    var addUser = { username: newUsername, theme: "1"};
    currentUsers.push(addUser);       //Add user to the user array
    socket.emit("show username", { username: newUsername });  //Show username
    socket.emit("change greeting"); //If they didn't have cookie then change greeting to new user
  });

  //If user wants to try to change username
  socket.on("change username", function(data) {
    if (updateUserName(data.username, data.newusername)) {
        socket.emit("change cookie", {
            newName: data.newusername
        });
        socket.emit("show username", { username: data.newusername });
        return null;
    }
    else{
        socket.emit("name change failed",data.newusername);
    }
  });

  //Change theme
  // socket.on("change theme", function(data){
  //   for (var i = 0; i < currentUsers.length; i++) {
  //     let userListParts = currentUsers[i].username.split("@#$%");
  //     let userListName = userListParts[0];
  //     if (userListName == data.username) {
  //       currentUsers[i].username = data.username+"@#$%"+data.theme;
  //     }
  //   }
  // });

});

//Get browser cookie
const getBrowserCookie = socket => {
  socket.emit("get browser cookie");
};

//Update rooms, if they have no people in them then remove them from list
function updateRooms(){
  //console.log("random ="+randomRooms.length);
  for(var i=privateRooms.length; i>0; i--){
    var roomName = privateRooms[i];
    var sizeOfRoom = io.sockets.adapter.rooms[roomName];
    if(sizeOfRoom < 1){
      privateRooms.splice(i,1);
    }
  }
  for(var i=randomRooms.length; i>0; i--){
    var roomName = randomRooms[i];
    var sizeOfRoom = io.sockets.adapter.rooms[roomName];
    if(sizeOfRoom < 1){
      randomRooms.splice(i,1);
    }
  }
}


//Check if username is not taken and does not contain '@#$%' we need '@#$%' for saving theme
const updateUserName = (currentUsername, newName) => {
  let currentNameParts = currentUsername.split("@#$%");
  let nameFromCurrentName = currentNameParts[0];
  let newNameParts = newName.split("@#$%");
  let nameFromNewName = newNameParts[0];
  for (var i = 0; i < currentUsers.length; i++) {
    let userListParts = currentUsers[i].username.split("@#$%");
    let userListName = userListParts[0];
    if (userListName == nameFromNewName) {
      return false;
    }
  }
  for (var i = 0; i < currentUsers.length; i++) {
    let userListParts = currentUsers[i].username.split("@#$%");
    let userListName = userListParts[0];
    if (userListName == nameFromCurrentName) {
      currentUsers[i].username = newName;
      return true;
    }
  }
};