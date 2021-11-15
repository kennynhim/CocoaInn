const ejs = require('ejs');
const express  = require("express");
const app = express(); 
const bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();
const port = 3000;

//for prarsing application/json
app.use(bodyParser.json());

//for parsing application/xwww-
app.use(bodyParser.urlencoded({extended: true}));

//for parsing multipart/form-data
app.use(upload.array());
app.use('/public', express.static('public'));

app.set ("view engine", "ejs");

//Creates the connection to the client
app.listen(port, function(){
    console.log("Connected");
})

//Handles a GET request to root
//Displays the home page after a connection is made to the client
app.get("/", function(req, res){
    res.render("indexEJS");
  });

//When a user clicks on the "Home" link in the menu bar
app.get("/index.html", function(req,res){
    res.render("indexEJS");
});

//When a user clicks on the "Reserve" link in the menu bar
app.get("/Reservation.html", function(req,res){
	res.render("reservationEJS");
});