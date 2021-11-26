const crypto = require('crypto');
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
	const userID = req.body.userID;
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
					   	numChildren: 0,
					   userID: userID});
			db.close();
		})
	})
})

//When employee/manager clicks on "Search Rooms" button on reservations page, or user adds more rooms from occupancySelection
//Query the database for a list of rooms with the selected reservation parameters
//Re-render the Reservations page with the list of available rooms
app.post("/staffSearchReservation.html", function(req, response){
	//First, store the reservation parameters into variables
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const numAdults = Number(req.body.numAdults);
	const numChildren = Number(req.body.numChildren);
	const userID = req.body.userID;

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
													rooms: availableRooms,
													userID: userID});
			db.close();
		})
	})	
})

//When employee/manager clicks on "Book" button on reservations page
//Add the selected room to the cart
app.post("/staffBooking.html", function(req, response){
	const checkIn = req.body.checkInFinal;
	const checkOut = req.body.checkOutFinal;
	const numAdults = Number(req.body.numAdultsFinal);
	const numChildren = Number(req.body.numChildrenFinal);
	roomNames.push(req.body.roomName);
	beds.push(Number(req.body.numBeds));
	descriptions.push(req.body.description);
	images.push(req.body.image);
	occupancies.push(Number(req.body.maxOccupancy));
	reservedRoomNums.push(Number(req.body.roomNum));
	totalPrices.push(Number(req.body.price));
	const userID = req.body.userID;
	numRooms++;
	
	if (!assertNumRooms()){
		console.log("ERROR: numRooms not asserted!");
		return;
	}
	
	//First, check if number of guests equals max occupancy
	//If they are equal, allow the reservation process to continue and go straight to the booking page
	if (numAdults + numChildren <= getCapacity()){
		
		let priceSum = 0;
		for (let x = 0; x < numRooms; x++){
			priceSum += getStayDuration(checkIn, checkOut)*totalPrices[x];
		}
		
		response.render("staffBookingEJS", {checkIn : checkIn,
								  checkOut : checkOut,
								  numRooms : numRooms,
								  numAdults : numAdults,
								  numChildren: numChildren,
								  roomNums: reservedRoomNums,
								  roomNames: roomNames,
								  occupancies: occupancies,
								  numBeds: beds,
								  descriptions: descriptions,
								  images: images,
								  price : priceSum,
								  userID: userID});
	}
	//Otherwise, if the user selects a room with an occupancy that cannot serve all of the guests
	//Then prompt the user if they would like to reserve multiple rooms
	//If they select no, return them to the Reservations page (cart will be cleared)
	//If they select yes, return to the Reservations page, and have them select another room (cart will be maintained)
	else{
		response.render("staffOccupancySelectionEJS", {checkIn: checkIn,
											checkOut: checkOut,
											numAdults: numAdults,
											numChildren: numChildren,
											userID: userID});
	}
	
})

//When employee/manager clicks on "Book Reservation" button on booking page
//Adds a reservation record to the database
app.post("/staffConfirm.html", function(req, response){
	const userID = req.body.userID;
	var reservation ={
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			email: req.body.email,
			phone: req.body.phone,
			checkIn: req.body.checkIn,
			checkOut: req.body.checkOut,
			numRooms: numRooms,
			adults: Number(req.body.numAdults),
			children: Number(req.body.numChildren),
			price: req.body.price,
			notes: "",
			assignedRoom: reservedRoomNums,
			confirmationNumber: crypto.randomUUID()
			}
	
	MongoClient.connect(dbURL, function(err, db){
		if (err)
			throw err;
		var dbo = db.db("CocoaInn");
		
		//Add the reservation to the database
		dbo.collection("reservation").insertOne(reservation, function(err, res){
			if (err)
				throw err;
			
			//Now update the room table by inserting the check in/out dates on the reservedDates array
			var dates = {checkIn: reservation.checkIn,
						checkOut: reservation.checkOut};
			const update = { $push: {"reservedDates": dates} };
			
			for (let x = 0; x < numRooms; x++){
				const query = {roomNum: reservedRoomNums[x]};
				dbo.collection("room").updateOne(query, update, function(err, res){
					if (err)
						throw err;

					//Render the confirmation page with the user's confirmation number
					if (x+1 === numRooms){
						response.render("staffConfirmationEJS", {confirmationNumber: reservation.confirmationNumber, userID: userID});
						clearCart();
						db.close();
					}
				})
			}
		})
		
	})	
})

//When staff clicks on "Search Reservations" button on staff home page
app.post("/staffSearchGuests.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffSearchReservationEJS", {userID: userID});
})

function searchReservation(request, response, confirmationNumber, firstName, lastName, email, phone, date, roomNum){
	const userID = request.body.userID;
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		var query = {};
		if (confirmationNumber != null){
			query = {confirmationNumber: confirmationNumber};
		}
		else if (firstName != null && lastName != null){
			query = {firstName: firstName, lastName: lastName};
		}
		else if (email != null){
			query = {email: email};
		}
		else if (phone != null){
			query = {phone: phone};
		}
		else if (date != null && roomNum != null){
		}
		dbo.collection("reservation").findOne(query, function(err2, result){
			if (err2)
				throw err2;
			if (result == null){
				alert("Could not find reservation.");
				db.close();
				return;
			}
			else{
				//Got the reservation
				//Get the rooms associated with this reservation
				//Retrieve all rooms first, then go through a loop to see if the room numbers match the reservation's assigned room numbers
				//Done this way because a single read operation on the database is slow compared to a loop, and may cause data to be skipped over
				dbo.collection("room").find({}).toArray(function(err3, rooms){
					if (err3)
						throw err3;
					let reservedRooms = [];
					
					for (let x = 0; x < result.assignedRoom.length; x++){
						for (let y = 0; y < rooms.length; y++){
							if (result.assignedRoom[x] === rooms[y].roomNum){
								reservedRooms.push(rooms[y]);
								break;
							}
						}
						if (x+1 === result.assignedRoom.length)
							response.render("staffModifyEJS", {reservation: result, rooms: reservedRooms, userID: userID});
					}
				})
			}			
		})
	})
}

//When an employee/manager enters a reservation confirmation number in the search field, and clicks on the "Search" button
//Or when employee/manager clicks on the confirmation number on the homepage for current guests
app.post("/staffModifyReservation.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	searchReservation(req, response, confirmationNumber, null, null, null, null, null, null);
	
	
	
	/*MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, result){
			if (err2)
				throw err2;
			if (result == null){
				alert("Could not find reservation.");
				db.close();
				return;
			}
			else{
				//Got the reservation
				//Get the rooms associated with this reservation
				//Retrieve all rooms first, then go through a loop to see if the room numbers match the reservation's assigned room numbers
				//Done this way because a single read operation on the database is slow compared to a loop, and may cause data to be skipped over
				dbo.collection("room").find({}).toArray(function(err3, rooms){
					if (err3)
						throw err3;
					let reservedRooms = [];
					
					for (let x = 0; x < result.assignedRoom.length; x++){
						for (let y = 0; y < rooms.length; y++){
							if (result.assignedRoom[x] === rooms[y].roomNum){
								reservedRooms.push(rooms[y]);
								break;
							}
						}
						if (x+1 === result.assignedRoom.length)
							response.render("staffModifyEJS", {reservation: result, rooms: reservedRooms, userID: userID});
					}
				})
			}
		})
	})*/
})

//When employee/manager searches for a reservation by guest name and then clicks "Submit"
app.post("/searchName.html", function(req, response){
	const firstName = req.body.firstName;
	const lastName = req.body.lastName;
	searchReservation(req, response, null, firstName, lastName, null, null, null, null);
})

//When employee/manager searches for a reservation by guest email and then clicks "Submit"
app.post("/searchEmail.html", function(req, response){
	const email = req.body.email;
	searchReservation(req, response, null, null, null, email, null, null, null);
})

//When employee/manager searches for a reservation by guest phone and then clicks "Submit"
app.post("/searchPhone.html", function(req, response){
	const phone = req.body.phone;
	searchReservation(req, response, null, null, null, null, phone, null, null);
})

//When employee/manager searches for a reservation by room and date and then clicks "Submit"
app.post("/searchRoom.html", function(req, response){
	const date = req.body.date;
	const roomNum = req.body.roomNum;
	searchReservation(req, response, null, null, null, null, null, date, roomNum);
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

function getStayDuration(checkIn, checkOut){
	var checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
	var checkOutDate = new Date(getYear(checkOut), getMonth(checkOut)-1, getDay(checkOut));
	
	let elapsedTime = checkOutDate.getTime()-checkInDate.getTime();
	return Math.floor(elapsedTime/(1000*60*60*24));
}

//Checks if user can cancel their reservation with a full refund
//Returns true if they can
function cancelIsValid(checkIn, cancelTime){
	const checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
	const cancelTimeMs = cancelTime*24*60*60*1000;
	const today = new Date();
	
	return today.getTime() <= checkInDate.getTime()-cancelTimeMs;
}

function getCapacity(){
	let sumOccupancy = 0;
	
	for (let x = 0; x < numRooms; x++)
		sumOccupancy += occupancies[x];
	
	return sumOccupancy;
}

function assertNumRooms(){
	return (numRooms === roomNames.length
		   && numRooms === beds.length
		   && numRooms === occupancies.length
		   && numRooms === descriptions.length
		   && numRooms === images.length
		   && numRooms === reservedRoomNums.length
		   && numRooms === totalPrices.length);
}