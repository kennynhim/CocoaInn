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
			user.password = null;
			displayHomePage(user.userID, db, response);
		})
	})
})

//When employee/manager clicks on the "Home" button
//Returns the user to the staff home page, no login authentication
app.post("/staffHome.html", function(req, response){
	const userID = req.body.userID;

	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		displayHomePage(userID, db, response);
	})
})

function displayHomePage(userID, db, response){
	//Query all reservations so we can display today's check ins, check outs, and current guests
	var dbo = db.db("CocoaInn");
	dbo.collection("reservation").find({}).toArray(function (err1, reservations){
		if (err1)
			throw err1;

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

		response.render("staffHomeEJS", {userID: userID, checkIns: checkIns, checkOuts: checkOuts, currentGuests: currentGuests});
	})
}

//When user clicks on "Logout" button
app.get("/logout.html", function(req, response){
	response.render("loginEJS");
})

//When employee/manager clicks on "Create Reservation" button
//Query the database for all rooms, whether vacant or not
//Display all of these rooms
app.post("/staffMakeReservation.html", function(req, response){
	clearCart();
	MongoClient.connect(dbURL, function(err, db){
		if (err)
			throw err;
		var dbo = db.db("CocoaInn");
		dbo.collection("room").find({}).toArray(function(err, result){
			if (err)
				throw err;
			const today = new Date();
			const todayString = today.toISOString();
			response.render("staffReservationEJS",
					   {bInit: true,
						numRooms: numRooms,
						rooms : result,
						checkIn: todayString.substr(0, 10),
						checkOut: todayString.substr(0,10),
					   	numAdults: 1,
					   	numChildren: 0});
			db.close();
		})
	})
})

//When employee/manager clicks on "Search Rooms" button on reservations page
//Query the database for a list of rooms with the selected reservation parameters
//Re-render the Reservations page with the list of available rooms
app.post("/staffSearchReservation.html", function(req, response){
	//First, store the reservation parameters into variables
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const numAdults = Number(req.body.numAdults);
	const numChildren = Number(req.body.numChildren);

	if (!validateDate(checkIn, checkOut))
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
				
				//If we already have one room in the cart, do not re-display that same room
				if (numRooms > 0){
					for (let z = 0; z < numRooms; z++){
						if (reservedRoomNums[z] === result[x].roomNum){
							bRoomAvailable = false;
							break;
						}
					}
				}
				if (bRoomAvailable){
					for (let y = 0; y < result[x].reservedDates.length; y++){
						const honoredCheckIn = result[x].reservedDates[y].checkIn;
						const honoredCheckOut = result[x].reservedDates[y].checkOut;
						if (!validateReservationConflict(checkIn, checkOut, honoredCheckIn, honoredCheckOut)){
							bRoomAvailable = false;
							break;
						}
					}
				}
				
				if (bRoomAvailable)
					availableRooms.push(result[x]);
			}
			
			//Re-render the Reservations page, but now with only the available rooms according to the user's reservation parameters
			response.render("staffReservationEJS", {bInit: false,
										  numRooms: numRooms,
										  checkIn: checkIn,
										  checkOut: checkOut,
										  numAdults: numAdults,
										  numChildren: numChildren,
										  rooms: availableRooms});
			db.close();
		})
	})	
})

//When employee/manager clicks on "Book" button on reservations page
//Add the selected room to the cart
app.post("/staffBooking.html", function(req, response){
	
})

function clearCart(){
	numRooms = 0;
	roomNames = [];
	beds = [];
	occupancies = [];
	descriptions = [];
	images = [];
	reservedRoomNums = [];
	totalPrices = [];	
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

function isCurrentGuest(checkIn, checkOut){
	const today = new Date();
	const checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
	const checkOutDate = new Date(getYear(checkOut), getMonth(checkOut)-1, getDay(checkOut));
	
	return today.getTime() > checkInDate.getTime() && today.getTime() < checkOutDate.getTime();
}

//TODO:
//Make Home page for employee/manager
//Render to Home page upon successful login