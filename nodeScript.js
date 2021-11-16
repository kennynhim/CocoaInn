const alert = require('alert');
const ejs = require('ejs');
const express  = require("express");
const app = express(); 
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const dbURL = "mongodb+srv://group7:group7Pass@cmpsc487gr7.0naf3.mongodb.net/CocoaInn?retryWrites=true&w=majority"
var multer = require('multer');
var upload = multer();
const port = 3000;

//for parsing application/xwww-
app.use(bodyParser.urlencoded({extended: true}));
//for prarsing application/json
app.use(bodyParser.json());

//for parsing multipart/form-data
//app.use(upload.array());

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

//When a user clicks on the "Search Rooms" button in Reservations.html
//Query the database for a list of rooms with the selected reservation parameters
app.post("/Reservation.html", function(req,res){
	//First, store the reservation parameters into variables
	let checkIn = req.body.checkIn;
	let checkOut = req.body.checkOut;
	let numRooms = Number(req.body.numRooms);
	let numAdults = Number(req.body.numAdults);
	let numChildren = Number(req.body.numChildren);

	//Validate input
	if (!validate(checkIn, checkOut, numRooms, numAdults, numChildren))
		return;
		
	//Now connect to database and query
	MongoClient.connect(dbURL, function(err, db){
		if (err)
			throw err;
		console.log("Successfully connected with CocoaInn DB");
		
		//Retrieve all rooms first into an array
		//Then sort out the rooms where our check in and check out dates do not cooperate
		var dbo = db.db("CocoaInn");
		dbo.collection("room").find({}).toArray(function(err, result){
			if (err)
				throw err;
			
			for (let x = 0; x < result.length; x++){
				for (let y = 0; y < result[x].reservedDates.length; y++){
					let honoredCheckIn = result[x].reservedDates[y].checkIn;
					let honoredCheckOut = result[x].reservedDates[y].checkOut;
					//TODO
					//Compare the honored reservation dates of this room with the requested reservation
					//If they conflict, ignore this room and do nothing
					//Otherwise, show the room as available to the user- display the room's info on reservations.html along with a Book Now button
				}
			}
			
			db.close();
		})
	})
});

//Validates inputs for reservation parameters
function validate(checkIn, checkOut, numRooms, numAdults, numChildren){
	if (numRooms <= 0){
		alert("Number of rooms must be > 0");
		return false;
	}

	if (numAdults <= 0){
		alert("Number of adults must be > 0");
		return false;
	}

	if (numChildren < 0){
		alert("Number of children must be >= 0");
		return false;
	}
	return validateDate(checkIn, checkOut);
}

//Validates the dates for a single reservation
//Returns false if check in comes on or after check out
//Otherwise returns true if valid
function validateDate(checkIn, checkOut){
	let checkInYear = getYear(checkIn);
	let checkInMonth = getMonth(checkIn);
	let checkInDay = getDay(checkIn);
	
	let checkOutYear = getYear(checkOut);
	let checkOutMonth = getMonth(checkOut);
	let checkOutDay = getDay(checkOut);
	
	if (checkInYear === checkOutYear){
		if (checkInMonth === checkOutMonth){
			if (checkInDay >= checkOutDay){
				alert("Check In date must come before Check Out date.");
				return false;
			}
		}
		else if (checkInMonth > checkOutMonth){
			alert("Check In date must come before Check Out date.");
			return false;
		}
	}
	else if (checkInYear > checkOutYear){
		alert("Check In date must come before Check Out date.");
		return false;		
	}
	
	return true;	
}

//Checks if two different reservations conflict, ie they share the same room and the reservation dates overlap
function validateReservationConflict(reqCheckIn, reqCheckOut, honoredCheckIn, honoredCheckOut){
	//First, validate the requested check in and check out dates
	if (!validateDate(reqCheckIn, reqCheckOut))
		return false;
	var reqCheckInDate = new Date(getYear(reqCheckIn), getMonth(reqCheckIn)-1, getDay(reqCheckIn));
	var reqCheckOutDate = new Date(getYear(reqCheckOut), getMonth(reqCheckOut)-1, getDay(reqCheckOut));
	var honoredCheckInDate = new Date(getYear(honoredCheckIn), getMonth(honoredCheckIn) - 1, getDay(honoredCheckIn));
	var honoredCheckOutDate = new Date(getYear(honoredCheckOut), getMonth(honoredCheckOut) -1, getDay(honoredCheckOut));
	
	if (reqCheckInDate.getTime() < honoredCheckInDate.getTime()){
		if (!reqCheckOutDate.getTime() <= honoredCheckInDate.getTime()){
			return false;
		}
	}
	else if (reqCheckInDate.getTime() === honoredCheckInDate.getTime())
		return false;
	else{
		if (reqCheckInDate.getTime() < honoredCheckOutDate.getTime())
			return false;
	}
	return true;
}

function getYear(date){
	return Number(date.substring(0,4));
}

function getMonth(date){
	return Number(date.substring(5,7));
}

function getDay(date){
	return Number(date.substring(8, date.length));
}