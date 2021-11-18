/*	This is a JavaScript file, executed on the Node JS Framework
**	Normally, JavaScript is executed on the client-side
**	Node JS is executed server side and allows us to connect to a database
**	Node JS also allows us to "serve" HTML files to the client and respond to HTTP GET and POST requests
**	Therefore, this is the main file from which we launch our website
**	To execute this file, you must have Node JS installed: https://nodejs.org/en/
**	Once installed, along with the required libraries listed below, open a command prompt/terminal and change directory(CD) to the location of this file
**	Then run the command: node nodeScript.js
**	Open a browser(only tested with Chrome), and enter in the address bar: localhost:3000
*/

/*	REQUIRED LIBRARIES
**	The section below is a declaration of external libraries and API's
**	These must be downloaded for this script to compile and execute
**	Open a command prompt or terminal, and run the commands to install these libraries
**	An associated link is provided where these commands can be found, along with their documentation
*/
const alert = require('alert'); //https://www.npmjs.com/package/alert-node
const ejs = require('ejs'); //https://ejs.co/
const express  = require("express"); //https://expressjs.com/
const app = express(); 
const bodyParser = require('body-parser');	//https://www.npmjs.com/package/body-parser
const MongoClient = require('mongodb').MongoClient;	//Terminal command: npm install mongodb
const dbURL = "mongodb+srv://group7:group7Pass@cmpsc487gr7.0naf3.mongodb.net/CocoaInn?retryWrites=true&w=majority"


const port = 3000;

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
//Query the database for all rooms, whether vacant or not
//Display all of these rooms
app.get("/Reservation.html", function(req,res){
	MongoClient.connect(dbURL, function(err, db){
		if (err)
			throw err;
		var dbo = db.db("CocoaInn");
		dbo.collection("room").find({}).toArray(function(err, result){
			if (err)
				throw err;
			res.render("reservationEJS", {bInit: true , rooms : result});
			db.close();
		})
	})
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
		
		//Retrieve all rooms first into an array
		var dbo = db.db("CocoaInn");
		dbo.collection("room").find({}).toArray(function(err, result){
			if (err)
				throw err;
			
			//From the list of retrieved rooms we got from the database, sort out the ones with a reservation conflict
			//Insert the available rooms into its own array
			let availableRooms = [];
			for (let x = 0; x < result.length; x++){
				let bRoomAvailable = true;
				if (numAdults+numChildren <= result[x].maxOccupancy){
					for (let y = 0; y < result[x].reservedDates.length; y++){

						let honoredCheckIn = result[x].reservedDates[y].checkIn;
						let honoredCheckOut = result[x].reservedDates[y].checkOut;
						if (!validateReservationConflict(checkIn, checkOut, honoredCheckIn, honoredCheckOut)){
							bRoomAvailable = false;
							break;
						}
					}
					if (bRoomAvailable)
						availableRooms.push(result[x]);
				}
			}
			console.log(availableRooms);
			res.render("reservationEJS", {bInit : false, rooms: availableRooms});
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
		if (reqCheckOutDate.getTime() > honoredCheckInDate.getTime()){
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