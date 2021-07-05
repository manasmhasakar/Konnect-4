$(function() {
  const socket = io.connect();
    
  //Some jQuery selectors that will be used
  let $nameForm = $('#nameForm');
  let $home = $('#homePage');
  let $gamePage = $('#gamePage');
  let $gameBoard = $('#gameBoard');
  let $createPrivate = $("#privateForm");
  let $findRandom = $("#random")
  let $joinForm = $("#joinForm");
  let $theme1 = $("#theme1");
  let $theme2 = $("#theme2");
  let $theme3 = $("#theme3");

  // Current User Info Object containing user information.
  let currentUserInfo = { username: "", theme:"", currentRoom:"", opponent:"", playerNum:""};

  //Event Listener for the game board
  function setupEventListeners(){
    const $board = $('#gameBoard');

    //Get Lowest open slot in the column
    function findLastEmptyCell(gamecol){
      const cells = $(`.gamecol[data-gamecol='${gamecol}']`);
      for(let i=cells.length-1;i>=0; i--){
        const $cell = $(cells[i]);
        if($cell.hasClass('empty')){
            return $cell;
        }
      }
      return null;
    }

    //If user hovers a column then show a "token" where piece would go if they were to click
    $board.on('mouseenter', '.empty.gamecol', function(){
        const gamecol = $(this).data('gamecol');
        const $lastEmptyCell = findLastEmptyCell(gamecol);
        $lastEmptyCell.addClass('next-turn');

    })

    //Remove token if they stop hovering
    $board.on('mouseleave', '.gamecol', function(){
        $('.gamecol').removeClass('next-turn');
    })

    //If user clicks on an column with empty space
    $board.on('click', '.gamecol.empty', function(){
      const gamecol = $(this).data('gamecol');
      const $lastEmptyCell = findLastEmptyCell(gamecol);
      if($lastEmptyCell == null){return;}
      $lastEmptyCell.removeClass('empty');
      if(currentUserInfo.playerNum == "1"){
        $lastEmptyCell.addClass('P1');
      }
      else{
        $lastEmptyCell.addClass('P2');
      }
      //console.log("gamerow:"+$lastEmptyCell.data('gamerow')+"gamecol:"+$lastEmptyCell.data('gamecol'));
      //console.log("Sending: "+ $lastEmptyCell.data('gamerow')+ $lastEmptyCell.data('gamecol'));/////////////////
      sendMove($lastEmptyCell.data('gamerow'), $lastEmptyCell.data('gamecol'));
    })

  }

  //Function used to stop event listeners so that they cannot make a move when not their turn.
  function pauseEventListeners(){
    const $board = $('#gameBoard');
    //console.log("paused?");
    $board.unbind('mouseenter');
    $board.unbind('mouseleave');
    $board.unbind('click');
    //In case old event listener active, remove effects it would have had.
    var hoveredInPast = document.getElementsByClassName('next-turn');
    for (var i = 0; i < hoveredInPast.length; i++) {
      const hovered = $(hoveredInPast);
      hovered.removeClass('next-turn');
    }
  }

  //Create grid on gameBoard
  function createGrid(){
    const $board=$('#gameBoard');
    $board.empty();       //Empty board to reset anything that may be there already
    //console.log("ran");
    //Make 6 rows
    for(let gamerow =0; gamerow < 6; gamerow++){
      const $gamerow = $('<div>')
        .addClass('gamerow');
      //Make 7 columns
      for(let gamecol =0; gamecol< 7  ; gamecol++){
          const $gamecol= $('<div>')
            .addClass('empty gamecol')
            .attr('data-gamecol', gamecol)
            .attr('data-gamerow', gamerow);
          $gamerow.append($gamecol);
      }
      $board.append($gamerow);
    }
  }

  //Function for sending move to other player, row and column of piece placed is sent
  function sendMove(gamerow, gamecol){
    pauseEventListeners();        //Stop this user from making any moves
    //console.log(""+gamerow,gamecol);
    document.getElementById('turnMessage').innerHTML = ""+currentUserInfo.opponent+"'s Turn. Please Wait."
    //Emit this so it can be sent to other person in room
    socket.emit("move made", {
      moveCol: gamecol,
      moveRow: gamerow,
      roomId: currentUserInfo.currentRoom
    });

  }

  //When user joins/attempts to join a room though private game Id.
  $joinForm.submit(function(e){
    e.preventDefault();
    var valInputted = document.getElementById("privRoom").value;
    socket.emit("join private", {
      username: currentUserInfo.username,
      roomCode: valInputted
    });
  });

  //When socket is told that it is their turn, gets row and col of opponent move in data
  socket.on("your turn", function(data){
    //console.log("Ran");
    //console.log("recieved"+data.movecol+" "+data.moverow);
    const cells = $(`.gamecol[data-gamecol='${data.movecol}']`);          //Find cells with the same column
    document.getElementById('turnMessage').innerHTML = "Hey "+currentUserInfo.username+", it's your turn." //Update turn message
    
    //From those with proper column, find cells with the right row
    for(let i=cells.length-1;i>=0; i--){
      const $cell = $(cells[i]);
      var gamerowValue = $cell.data('gamerow');
      //console.log(gamerowValue);
      //console.log("i="+i);

      //If row and column match then opponent placed it there
      if(gamerowValue == data.moverow){
        $cell.removeClass('empty');       //Remove empty property
        //console.log($cell);

        //Add corresponding class depending on if user is P1 or P2
        if(currentUserInfo.playerNum == 1){
          $cell.addClass('P2');
        }
        else{
          $cell.addClass('P1');
        }     
      }
    }
    //Set player class variable depending on what type of player current user is
    //Will be used when checking if OPPONENT won
    if (currentUserInfo.playerNum == 1){
      var playerClass = "P2";
    }
    else{
      var playerClass = "P1";
    }
    //Check if OPPONENT WON
    if(checkForWinner(data.moverow, data.movecol, playerClass) == true){
      document.getElementById("gameMessage").innerHTML = "Your opponent '"+currentUserInfo.opponent+"' outplayed you. You lose. <br>Reload page to find another game.";
      document.getElementById("turnMessage").innerHTML = "";
      socket.emit("opponent won", currentUserInfo.currentRoom);
      return;
    }
    //Check if it was a tie
    else if(checkTie() == true){
      socket.emit("we tied",currentUserInfo.currentRoom);
      document.getElementById("gameMessage").innerHTML = "You and '"+currentUserInfo.opponent+"' tied. <br>Reload page to find another game.";
      document.getElementById("turnMessage").innerHTML = "";
      return;
    }
    //If opponent hasn't won and game isn't over with a tie 
    //then set up event listeners so user can make a move
    else{
      setupEventListeners();
    }

  });

  //Function used to check if there was a tie
  //No empty spaces left and this only gets called if no one has won yet
  function checkTie(){
    var openSlots = document.getElementsByClassName("empty");
    if(openSlots.length == 0){
      return true;
    }
    return null;
  }

  //Function to check if Opponent has won
  function checkForWinner(gamerow, gamecol, opponentClass) {

    //Pass a "cell" with x and y co-ordinates
    function $getCell(y, x) {
      return $(`.gamecol[data-gamerow='${y}'][data-gamecol='${x}']`);
    }

    //Function used to count number of a user pieces in a direction
    //takes in a checkdirection object with x and y value
    function checkDirection(checkDirection) {
      let total = 0;
      let y = gamerow + checkDirection.y;
      let x = gamecol + checkDirection.x;
      let $next = $getCell(y, x);
      //While in bounds and cell is still a user piece increase total
      while (y >= 0 && y < 6 && x >= 0 && x < 7 && $next.hasClass(opponentClass)) {
          total++;
          y += checkDirection.y;
          x += checkDirection.x;
          $next = $getCell(y, x);
      }
      return total;
    }

    //Function that uses checkDirection in both directions
    //If verical, check up and down; horizontal left and right... similar with diagonals
    function checkWin(yMove, xMove) {
      const total = 1 +
        checkDirection(yMove) +
        checkDirection(xMove);
      if (total >= 4) {
        return true;
      } else {
        return null;
      }
    }

    //Check Diagonal with '/' Slope
    function checkCounterDiag() {
      return checkWin({y: 1, x: -1}, {y: -1, x: 1});
    }

    //Diagonal with '\' Slope
    function checkMainDiag() {
      return checkWin({y: 1, x: 1}, {y: -1, x: -1});
    }

    //Verical Direction
    function checkVerticals() {
      return checkWin({y: -1, x: 0}, {y: 1, x: 0});
    }

    //Horizontal Direction
    function checkHorizontals() {
      return checkWin({y: 0, x: -1}, {y: 0, x: 1});
    }
    
    //return results of OR of checking all directions, user won if any direction is true
    return checkVerticals() || checkHorizontals() || checkCounterDiag() || checkMainDiag();
  }

  //Stop event listener and update turn message if not user's turn
  socket.on("not my turn", function(){
    document.getElementById("turnMessage").innerHTML = currentUserInfo.opponent+"'s Turn. Please Wait.";
    pauseEventListeners();
  });

  //Allert user it was a tie and that game is over
  socket.on("game tie", function(){
    document.getElementById("turnMessage").innerHTML = "";
    document.getElementById("gameMessage").innerHTML = "You and '"+currentUserInfo.opponent+"' tied. <br>Reload page to find another game.";
    socket.emit("game over", currentUserInfo.currentRoom);
  });

  //Alert use they won and game is over
  socket.on("You win", function(){
    document.getElementById("turnMessage").innerHTML = "";
    document.getElementById("gameMessage").innerHTML = "You won against '"+currentUserInfo.opponent+"'. You Win!<br>Reload page and see if you can win again!";
    socket.emit("game over", currentUserInfo.currentRoom);
  });

  //Alert user that they will start, will not check for any wins or ties since only starting
  socket.on("You go first", function(){
    document.getElementById("turnMessage").innerHTML = "Hey "+currentUserInfo.username+", it's your turn.";
  });

  //If user that created room responds to current user that they know they joined
  socket.on("reply recieve", function(data){
    $home.css("display","none");
    //console.log("Joined" +data.roomId);
    $gamePage.css("display","inline-block");
    document.getElementById("gameMessage").innerHTML = "Playing Against "+data.opponent+".";
    currentUserInfo.opponent = data.opponent;
    currentUserInfo.currentRoom = data.roomId;
    currentUserInfo.playerNum = "2";
    socket.emit("you start", currentUserInfo.currentRoom);  //Ask person waiting to go first
    createGrid();
  });

  //Tell user who made room and waiting for opponent to join that someone has joined
  socket.on("someone joined", function(opponent){
    document.getElementById("gameMessage").innerHTML = "Playing Against "+opponent+".";
    currentUserInfo.opponent = opponent;
    currentUserInfo.playerNum = "1";
    //Allow user to make move
    setupEventListeners();
    //Meanwhile send opponent acknowledgement saying you know they joined.
    socket.emit("reply to join",{
      roomCode: currentUserInfo.currentRoom,
      username: currentUserInfo.username
    });
  });

  //When user wants to make private match; make new room and tell
  // them the room code that friend will need to join.
  socket.on("room made",function(shareCode){
    $home.css("display","none");
    //console.log(shareCode);
    currentUserInfo.currentRoom = shareCode;
    $gamePage.css("display","inline-block");
    document.getElementById("gameMessage").innerHTML = "Hello "+currentUserInfo.username+
      ".<br> Please get your friend to join RoomId:"+shareCode;
      createGrid();
  });

  //When user presses create private room
  $createPrivate.submit(function(e){
    e.preventDefault();
      var roomCode = ""+Math.floor(Math.random() * (1000000 - 100000) + 100000);
      //console.log(roomCode);
      socket.emit("create room",roomCode);
  });

  // //Change theme to default theme
  // $theme1.submit(function(e){
  //   e.preventDefault();
  //   if($gameBoard.hasClass("dark")){
  //     $gameBoard.removeClass("dark");
  //   }
  //   if($gameBoard.hasClass("other")){
  //     $gameBoard.removeClass("other");
  //   }
  //   currentUserInfo.theme = "1"
  //   socket.emit("change theme", {
  //     username: currentUserInfo.username,
  //     theme: currentUserInfo.theme
  //   });
  //   saveUsernameCookie(currentUserInfo.username+"@#$%"+currentUserInfo.theme);
  // });

  // //Change to dark theme
  // $theme2.submit(function(e){
  //   e.preventDefault();
  //   if($gameBoard.hasClass("other")){
  //     $gameBoard.removeClass("other");
  //   }
  //   if($gameBoard.hasClass("dark")){
  //   }
  //   else{
  //     $gameBoard.addClass("dark");
  //     //console.log("here");
  //   }
  //   currentUserInfo.theme = "2"
  //   socket.emit("change theme", {
  //     username: currentUserInfo.username,
  //     theme: currentUserInfo.theme
  //   });
  //   saveUsernameCookie(currentUserInfo.username+"@#$%"+currentUserInfo.theme);
  // });

  // //Change to third theme
  // $theme3.submit(function(e){
  //   e.preventDefault();
  //   if($gameBoard.hasClass("dark")){
  //     $gameBoard.removeClass("dark");
  //   }
  //   if($gameBoard.hasClass("other")){
  //   }
  //   else{
  //     $gameBoard.addClass("other");
  //   }
  //   currentUserInfo.theme = "3"
  //   socket.emit("change theme", {
  //     username: currentUserInfo.username,
  //     theme: currentUserInfo.theme
  //   });
  //   saveUsernameCookie(currentUserInfo.username+"@#$%"+currentUserInfo.theme);
  // });

  //Get browser cookie
  socket.on("get browser cookie", function() {
    socket.emit("send browser cookie", getUsernameCookie());  //Send server the cookie
  });
 
  //Function used to get the valie of the cookie stored
  function getUsernameCookie(){
    var value = "; " + document.cookie; 
    var parts = value.split("; username=");
    if (parts.length == 2)
      return parts
        .pop()
        .split(";")
        .shift();
  }
  
  // Shows the connected users name and sets the theme they used from cookie
  socket.on("show username", function(user) {
      var input = user.username;
      var parts = input.split("@#$%");
      document.getElementById('nameFeedback').innerHTML="";
      currentUserInfo = { username: parts[0], theme: parts[1]};
      //console.log("username: "+ currentUserInfo.username);
      document.getElementById("who").value = "" + currentUserInfo.username;
      saveUsernameCookie(currentUserInfo.username+"@#$%"+currentUserInfo.theme);
      //console.log("Theme: "+ currentUserInfo.theme);
      setTheme();
  });

  //If user has no cookie then display different welcome
  socket.on("change greeting", function(){
    document.getElementById("greet").innerHTML = "You're New! Welcome!";
  });
  
  //If someone submits a change name request
  $nameForm.submit(function(e){
      e.preventDefault();
      var valInputted = document.getElementById("who").value;
      if(valInputted.includes("@#$%")){
        document.getElementById("nameFeedback").innerHTML ="Username cannot contain '@#$%'";
        document.getElementById("who").value = "" + currentUserInfo.username;
        return;
      }
      if(valInputted !== currentUserInfo.username){
          var oldToPass = currentUserInfo.username+"@#$%"+currentUserInfo.theme;
          var newToPass = valInputted+"@#$%"+currentUserInfo.theme;
          socket.emit("change username", {
              username: oldToPass,
              newusername: newToPass
          });
      }
  });
  
  //If username is taken
  socket.on("name change failed", function(newUsername) {
    var takenUsername = newUsername.split('@#$%');
    document.getElementById("nameFeedback").innerHTML ="The username "+takenUsername[0]+" is taken. Please choose a different username.";
    document.getElementById("who").value = "" + currentUserInfo.username;
  });

  //If room user tried to join using code does not exist/already has 2 people
  socket.on("invalid room", function() {
    document.getElementById("roomFeedback").innerHTML ="The room  you tried to join is full/doesn't exist.";
    document.getElementById("privRoom").value = "";
  });

  //Change the value of the cookie
  socket.on("change cookie", function(data) {
    saveUsernameCookie(data.newName);
  });

  //Make a new cookie to overwrite any existing, set it to expire after 30 mins
  function saveUsernameCookie(username){
    //console.log(username);
    var now = new Date();
    now.setTime(now.getTime() + 30 * 60 * 1000); // 30 minute cookie
    document.cookie =
      "username="+username+"; expires="+now.toUTCString()+";"+" path=/";
  }

  //Set theme when user connects based on their cookie
  function setTheme(){
    if (currentUserInfo.theme == "1"){
      if($gameBoard.hasClass("dark")){
        $gameBoard.removeClass("dark");
      }
      if($gameBoard.hasClass("other")){
        $gameBoard.removeClass("other");
      }
    }
    else if(currentUserInfo.theme == "2"){
      if($gameBoard.hasClass("other")){
        $gameBoard.removeClass("other");
      }
      if($gameBoard.hasClass("dark")){
      }
      else{
        $gameBoard.addClass("dark");
        //console.log("Here");
      }
    }
    else if(currentUserInfo.theme = "3"){
      if($gameBoard.hasClass("dark")){
        $gameBoard.removeClass("dark");
      }
      if($gameBoard.hasClass("other")){
      }
      else{
        $gameBoard.addClass("other");
      }
    }
  }
  

});