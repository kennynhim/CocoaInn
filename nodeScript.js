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
			res.render("reservationEJS",
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
});

//When a user clicks on the "Search Rooms" button in Reservations.html, or user adds more rooms from occupancySelection
//Query the database for a list of rooms with the selected reservation parameters
//Re-render the Reservations page with the list of available rooms
app.post("/Reservation.html", function(req,res){
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
			res.render("reservationEJS", {bInit: false,
										  numRooms: numRooms,
										  checkIn: checkIn,
										  checkOut: checkOut,
										  numAdults: numAdults,
										  numChildren: numChildren,
										  rooms: availableRooms});
			db.close();
		})
	})
});

//When a user clicks on the "Book" button on the Reservations page
//Add the selected room to the cart
app.post("/booking.html", function(req, res){
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
	numRooms++;
	
	if (!assertNumRooms()){
		console.log("ERROR: numRooms not asserted!");
		return;
	}
	
	//First, check if number of guests equals max occupancy
	//If they are equal, allow the reservation process to continue and go straight to the booking page
	if (numAdults + numChildren <= getCapacity()){
		
		let priceSum = 0;
		for (let x = 0; x < numRooms; x++)
			priceSum += totalPrices[x];			
		
		res.render("bookingEJS", {checkIn : checkIn,
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
								  price : priceSum});
	}
	//Otherwise, if the user selects a room with an occupancy that cannot serve all of the guests
	//Then prompt the user if they would like to reserve multiple rooms
	//If they select no, return them to the Reservations page (cart will be cleared)
	//If they select yes, return to the Reservations page, and have them select another room (cart will be maintained)
	else{
		res.render("occupancySelectionEJS", {checkIn: checkIn,
											checkOut: checkOut,
											numAdults: numAdults,
											numChildren: numChildren});
	}
})

//When a user clicks on the "Book Reservation" button on the Booking page
//Adds a reservation record to the database
app.post("/confirmation.html", function(req, response){
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
						response.render("confirmationEJS", {confirmationNumber: reservation.confirmationNumber});
						clearCart();
						db.close();
					}
				})
			}
		})
		
	})
})

//When a user enters a reservation confirmation number and clicks on the Search button
//Or, when the user clicks on the "Back" button after selecting a reservation modification button
app.post("/reservationDetails.html", function (req, response){
	const confirmationNumber = req.body.confirmationNumber;
	MongoClient.connect(dbURL, function(err1, db){
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
					}
					response.render("modifyEJS", {reservation: result, rooms: reservedRooms});
					db.close();
				})
			}
		})
	})
})

//When user clicks on the "Change Check In/Out" button on the details page
app.post("/modifyDate.html", function(req, response){
	const confirmation = req.body.confirmationNumber;
	MongoClient.connect(dbURL, function(err, db){
		if (err)
			throw err;
		var dbo = db.db("CocoaInn");
		const query = {confirmationNumber: confirmation};
		dbo.collection("reservation").findOne(query, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("modifyDateEJS", {reservation: reservation});
			db.close();
		})
	})
})

//When user modifies their reservation detail by changing the check in/out date
//And the user clicks on "submit" to change the reservation
app.post("/changeDateRequested.html", function(req, response){
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const confirmation = req.body.confirmationNumber;
	
	if (!validateDate(checkIn, checkOut))
		return;
	
	//Go through all reservations (except for ours)
	//If the reserved rooms match, and the dates between our reservation and theirs overlap, do not allow the date change
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		//First, get the reservation object
		const query = {confirmationNumber: confirmation};
		dbo.collection("reservation").findOne(query, function(err2, reservation){
			if (err2)
				throw err2;
			if (reservation != null){
				dbo.collection("reservation").find({}).toArray(function(err3, honoredReservations){
					if (err3)
						throw err3;
					let bCanChange = true;
					let roomNum = 0;
					for (let x = 0; x < reservation.assignedRoom.length; x++){
						for (let y = 0; y < honoredReservations.length; y++){
							for(let z = 0; z < honoredReservations[y].assignedRoom.length; z++){
								if (confirmation != honoredReservations[y].confirmationNumber && reservation.assignedRoom[x] === honoredReservations[y].assignedRoom[z]){
									if (!validateReservationConflict(checkIn, checkOut, honoredReservations[y].checkIn, honoredReservations[y].checkOut)){
										bCanChange = false;
										roomNum = reservation.assignedRoom[x];
										break;
									}
								}
							}
							if (!bCanChange)
								break;
						}
						if (!bCanChange)
							break;
					}

					//If !bCanChange, display a message and remain on the page
					if (!bCanChange){
						alert(`The new dates for room ${roomNum} conflict with another reservation.`);
						db.close();
						return;
					}
					else{			//Otherwise if bCanChange, update the reservation collection and room collection, and return to the details page
						const originalCheckIn = reservation.checkIn;
						dbo.collection("reservation").updateOne({confirmationNumber: confirmation}, { $set: {"checkIn": checkIn, "checkOut": checkOut} }, function(err4, result1){
							if (err4)
								throw err4;
							//First, get all rooms so we can pass it in to modifyEJS
							let reservedRooms = [];
							dbo.collection("room").find({}).toArray(function(err5, rooms){
								if (err5)
									throw err5;
								//Insert into reservedRooms array so we can pass it into modifyEJS
								for (let x = 0; x < reservation.assignedRoom.length; x++){
									for (let y = 0; y < rooms.length; y++){
										if (reservation.assignedRoom[x] === rooms[y].roomNum){
											reservedRooms.push(rooms[y]);
											break;
										}
									}
								}
								
								//Update the rooms with the new check in and check out dates
								for (let x = 0; x < reservation.assignedRoom.length; x++){
									const query = {roomNum: reservation.assignedRoom[x], "reservedDates.checkIn": originalCheckIn};
									const update = {$set: {"reservedDates.$.checkIn": checkIn, "reservedDates.$.checkOut": checkOut}};
									dbo.collection("room").updateOne(query, update, function(err6, result2){
										if (err6)
											throw err6;
									});
									if (x+1 === reservation.assignedRoom.length){
										//Get the new reservation info
										dbo.collection("reservation").findOne({confirmationNumber: confirmation}, function(err7, newReservation){
											if (err7)
												throw err7;
											if (newReservation != null)
												response.render("modifyEJS", {reservation: newReservation, rooms: reservedRooms});												
										})
									}
								}
							})
						})
					}
				})
			}
		})
	})
})

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

function getStayDuration(checkIn, checkOut){
	var checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
	var checkOutDate = new Date(getYear(checkOut), getMonth(checkOut)-1, getDay(checkOut));
	
	let elapsedTime = checkOutDate.getTime()-checkInDate.getTime();
	return Math.floor(elapsedTime/(1000*60*60*24));
}

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