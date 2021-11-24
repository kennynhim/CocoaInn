const alert = require('alert'); //https://www.npmjs.com/package/alert-node
const ejs = require('ejs'); //https://ejs.co/
const express  = require("express"); //https://expressjs.com/
const app = express(); 
const bodyParser = require('body-parser');	//https://www.npmjs.com/package/body-parser
const Mongo = require('mongodb');
const MongoClient = Mongo.MongoClient;	//Terminal command: npm install mongodb
const dbURL = "mongodb+srv://group7:group7Pass@cmpsc487gr7.0naf3.mongodb.net/CocoaInn?retryWrites=true&w=majority"

const port = 3000;
var numRooms = 0;
var roomNames = [];
var beds = [];
var occupancies = [];
var descriptions = [];
var images = [];
var reservedRoomNums = [];
var totalPrices = [];

//for parsing application/xwww-
app.use(bodyParser.urlencoded({extended: true}));

//for prarsing application/json
app.use(bodyParser.json());

//Allows our css styling file to be located and used
app.use('/public', express.static('public'));

//For serving and rendering HTML files
//Instead of using HTML directly, we use ejs files
//The contents of the ejs file is a direct copy of the HTML file
app.set ("view engine", "ejs");

//Creates the connection to the client
app.listen(port, function(){
    console.log("Connected");
})

//Displays the staff login page after a connection is made
app.get("/", function(req, res){
    res.render("loginEJS");
  });

//When employee/manager enters a username and password, and clicks on the "Login" button
app.post("/staffLogin.html", function(req, response){
	const username = req.body.username;
	const password = req.body.password;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("staff").findOne({username: username, password: password}, function (err2, user){
			if (err2)
				throw err2;
			if (user == null){
				alert("Invalid login.");
				db.close();
				return;
			}
			//Clear out the password (may not be the secure way, but w/e)
			user.password = null;
			
			//Query all reservations so we can display today's check ins, check outs, and current guests
			dbo.collection("reservation").find({}).toArray(function (err3, reservations){
				if (err3)
					throw err3;
				
				let checkIns = [];
				let currentGuests = [];
				let checkOuts = [];
				const today = new Date();
				const todayString = today.toISOString();
				
				//Get all of today's check ins and check outs
				for (let x = 0; x < reservations.length; x++){
					if (reservations[x].checkIn === todayString.substr(0,10))
						checkIns.push(reservations[x]);
					else if (reservations[x].checkOut === todayString.substr(0,10))
						checkOuts.push(reservations[x]);
					else if (isCurrentGuest(reservations[x].checkIn, reservations[x].checkOut))
						currentGuests.push(reservations[x]);
				}
			
				response.render("staffHomeEJS", {user: user, checkIns: checkIns, checkOuts: checkOuts, currentGuests: currentGuests});
			})
		})
	})
})

function getYear(date){
	return Number(date.substring(0,4));
}

function getMonth(date){
	return Number(date.substring(5,7));
}

function getDay(date){
	return Number(date.substring(8, date.length));
}

function isCurrentGuest(checkIn, checkOut){
	const today = new Date();
	const checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
	const checkOutDate = new Date(getYear(checkOut), getMonth(checkOut)-1, getDay(checkOut));
	
	return today.getTime() > checkInDate.getTime() && today.getTime() < checkOutDate.getTime();
}

//TODO:
//Make Home page for employee/manager
//Render to Home page upon successful login