const crypto = require('crypto');
const alert = require('alert'); //https://www.npmjs.com/package/alert-node
const ejs = require('ejs'); //https://ejs.co/
const express  = require("express"); //https://expressjs.com/
const app = express(); 
const bodyParser = require('body-parser');	//https://www.npmjs.com/package/body-parser
const fs = require('fs');
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
			displayHomePage(user.userID, db, response, user.manager);
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
		var dbo = db.db("CocoaInn");
		dbo.collection("staff").findOne({userID: userID}, function(err2, user){
			if (err2)
				throw err2;
			displayHomePage(userID, db, response, user.manager);
		})
	})
})

function displayHomePage(userID, db, response, bManager){
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
			if (reservations[x].checkIn === todayString.substr(0,10) && reservations[x].bCheckedIn == false)
				checkIns.push(reservations[x]);
			else if (reservations[x].checkOut === todayString.substr(0,10))
				checkOuts.push(reservations[x]);
			else if (isCurrentGuest(reservations[x].checkIn, reservations[x].checkOut))
				currentGuests.push(reservations[x]);
		}
		dbo.collection("notifications").find({}).toArray(function (err2, notifications){
			if (err2)
				throw err2;
			//Check if this is an employee or manager
			response.render("staffHomeEJS", {userID: userID, checkIns: checkIns, checkOuts: checkOuts, currentGuests: currentGuests, numMessages: notifications.length, bIsManager: bManager});
		})
	})
}

//When user clicks on "Logout" button
app.get("/logout.html", function(req, response){
	response.render("loginEJS");
})

//When user clicks on "Messages" button on staff homepage
app.post("/viewMessages.html", function(req, response){
	const userID = req.body.userID;
	
	//Query notifications table for all notifications
	//Display messages page
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("notifications").find({}).toArray(function(err2, notifications){
			if (err2)
				throw err2;
			response.render("staffMessagesEJS", {notifications: notifications, userID: userID});
		})
	})
})

//Called when employee/manager views a reservation detail that had a new message
//Removes the associated reservation's notification from the notifications table
function removeNotification(confirmationNumber){
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("notifications").deleteMany({confirmationNumber: confirmationNumber}, function(err2, result){
			if (err2)
				throw err2;
		})
	})
}

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

	if (!validateDate(checkIn, checkOut)){
		alert("Check In date must come before Check Out date");
		return;
	}
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
			notes: [],
			assignedRoom: reservedRoomNums,
			confirmationNumber: crypto.randomUUID(),
			bCheckedIn: false
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

function searchReservation(request, response, confirmationNumber, firstName, lastName, email, phone){
	const userID = request.body.userID;
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		var query = {};
		if (confirmationNumber != null){
			query = {confirmationNumber: confirmationNumber};
		}
		else if (firstName != null || lastName != null){
			if (firstName.length === 0 && lastName.length === 0){
				alert("Please enter a name");
				return;
			}
			else if (firstName.length > 0 && lastName.length > 0)
				query = {firstName: firstName, lastName: lastName};
			else if (firstName.length > 0 && lastName.length === 0)
				query = {firstName: firstName};
			else if (firstName.length === 0 && lastName.length > 0)
				query = {lastName: lastName};
		}
		else if (email != null){
			query = {email: email};
		}
		else if (phone != null){
			query = {phone: phone};
		}
		dbo.collection("reservation").find(query).toArray(function(err2, result){
			if (err2)
				throw err2;
			if (result.length == 0){
				alert("Could not find reservation.");
				db.close();
				return;
			}
			else if (result.length == 1){
				//Got the reservation
				//Get the rooms associated with this reservation
				//Retrieve all rooms first, then go through a loop to see if the room numbers match the reservation's assigned room numbers
				//Done this way because a single read operation on the database is slow compared to a loop, and may cause data to be skipped over
				dbo.collection("room").find({}).toArray(function(err3, rooms){
					if (err3)
						throw err3;
					let reservedRooms = [];
					
					for (let x = 0; x < result[0].assignedRoom.length; x++){
						for (let y = 0; y < rooms.length; y++){
							if (result[0].assignedRoom[x] === rooms[y].roomNum){
								reservedRooms.push(rooms[y]);
								break;
							}
						}
						if (x+1 === result[0].assignedRoom.length){
							removeNotification(result[0].confirmationNumber);
							const today = new Date();
							const checkIn = result[0].checkIn;
							const checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
							let bCanCheckIn = true;
							if (today.getTime() < checkInDate.getTime())
								bCanCheckIn = false;
							response.render("staffModifyEJS", {reservation: result[0], rooms: reservedRooms, userID: userID, bCanCheckIn: bCanCheckIn});
						}
					}
				})
			}
			else{	//Got multiple reservation matches. Go to the reservation search results page and display all the matching reservations
				response.render("staffReservationSearchResultEJS", {reservations: result, userID: userID})
			}
		})
	})
}

function searchReservationRoomDate(request, response, date, roomNum){
	const targetDate = new Date(getYear(date), getMonth(date)-1, getDay(date));
	const targetDateTime = targetDate.getTime();
	const userID = request.body.userID;
	
	console.log(date);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").find({}).toArray(function(err2, reservations){
			if (err2)
				throw err2;
			var foundReservations = [];
			for (let x = 0; x < reservations.length; x++){
				let checkIn = new Date(getYear(reservations[x].checkIn), getMonth(reservations[x].checkIn)-1, getDay(reservations[x].checkIn));
				let checkOut = new Date(getYear(reservations[x].checkOut), getMonth(reservations[x].checkOut)-1, getDay(reservations[x].checkOut));
				if (date == reservations[x].checkIn || date == reservations[x].checkOut || (targetDateTime > checkIn.getTime() && targetDateTime < checkOut.getTime())){
					for (let y = 0; y < reservations[x].assignedRoom.length; y++){
						if (reservations[x].assignedRoom[y] == roomNum){
							foundReservations.push(reservations[x]);
							break;
						}
					}	
				}
			}
			if (foundReservations.length === 0){
				alert("Could not find reservation.");
				db.close();
				return;			
			}
			else if (foundReservations.length === 1){
				dbo.collection("room").find({}).toArray(function(err3, rooms){
					if (err3)
						throw err3;
					let reservedRooms = [];

					for (let x = 0; x < foundReservations[0].assignedRoom.length; x++){
						for (let y = 0; y < rooms.length; y++){
							if (foundReservations[0].assignedRoom[x] === rooms[y].roomNum){
								reservedRooms.push(rooms[y]);
								break;
							}
						}
						if (x+1 === foundReservations[0].assignedRoom.length){
							removeNotification(foundReservations[0].confirmationNumber);
							const today = new Date();
							const checkIn = foundReservations[0].checkIn;
							const checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
							let bCanCheckIn;
							if (today.getTime() < checkInDate.getTime())
								bCanCheckIn = false;
							else
								bCanCheckIn = true;
							response.render("staffModifyEJS", {reservation: foundReservations[0], rooms: reservedRooms, userID: userID, bCanCheckIn: bCanCheckIn});
						}
					}
				})
			}
			else{
				response.render("staffReservationSearchResultEJS", {reservations: foundReservations, userID: userID})			
			}
		})			
	})
}

//When employee/manager clicks on "Submit" button on modify date page after entering in a new check in and check out date
app.post("/tryModifyDate.html", function(req, response){
	//Calculate the price change, if any
	//Display the price change to user
	//Ask if they want to continue with modification
	const checkIn = req.body.newCheckIn;
	const checkOut = req.body.newCheckOut;
	const confirmation = req.body.confirmationNumber;
	const userID = req.body.userID;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmation}, function(err2, reservation){
			if (err2)
				throw err2;
			if (reservation != null){
				//First, check if the new check in/out date conflicts with another reservation
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
					else{
						//Get the total price for the new check in and check out dates
						dbo.collection("room").find({}).toArray(function(err3, rooms){
							if (err3)
								throw err3;
							let total = 0;
							for (let x = 0; x < reservation.assignedRoom.length; x++){
								for (let y = 0; y < rooms.length; y++){
									if (reservation.assignedRoom[x] === rooms[y].roomNum){
										total += getStayDuration(checkIn, checkOut)*rooms[y].price;
										break;
									}
								}
							}
							//Get price change
							let priceChange = total - reservation.price;
							response.render("staffConfirmModifyDateEJS", {userID: userID,
																		  reservation: reservation,
																		  newCheckIn: checkIn,
																		  newCheckOut: checkOut,
																		  newPrice: total,
																		  priceChange: priceChange});
						})
					}
				})
			}
		})
	})
})

//When staff clicks on "Continue" from confirming the reservation date change
app.post("/changeDateRequested.html", function(req, response){
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const confirmation = req.body.confirmationNumber;
	const userID = req.body.userID;
	
	if (!validateDate(checkIn, checkOut)){
		alert("Check In date must come before Check Out date.");
		return;
	}
	
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
				//update the reservation collection and room collection, and return to the details page
				const originalCheckIn = reservation.checkIn;
				dbo.collection("reservation").updateOne({confirmationNumber: confirmation}, { $set: {"checkIn": checkIn, "checkOut": checkOut, "price": req.body.price} }, function(err4, result1){
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
									if (newReservation != null){
										const today = new Date();
										const checkIn = newReservation.checkIn;
										const checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
										let bCanCheckIn;
										if (today.getTime() < checkInDate.getTime())
											bCanCheckIn = false;
										else
											bCanCheckIn = true;
										response.render("staffModifyEJS", {userID: userID, reservation: newReservation, rooms: reservedRooms, bCanCheckIn: bCanCheckIn});
										}			
									})
								}
							}
						})
					})
				})
			}
		})
	})
})

//When an employee/manager enters a reservation confirmation number in the search field, and clicks on the "Search" button
//Or when employee/manager clicks on the confirmation number on the homepage for current guests
app.post("/staffModifyReservation.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	searchReservation(req, response, confirmationNumber, null, null, null, null);
})

//When employee/manager searches for a reservation by guest name and then clicks "Submit"
app.post("/searchName.html", function(req, response){
	const firstName = req.body.firstName;
	const lastName = req.body.lastName;
	searchReservation(req, response, null, firstName, lastName, null, null);
})

//When employee/manager searches for a reservation by guest email and then clicks "Submit"
app.post("/searchEmail.html", function(req, response){
	const email = req.body.email;
	searchReservation(req, response, null, null, null, email, null);
})

//When employee/manager searches for a reservation by guest phone and then clicks "Submit"
app.post("/searchPhone.html", function(req, response){
	const phone = req.body.phone;
	searchReservation(req, response, null, null, null, null, phone);
})

//When employee/manager searches for a reservation by room and date and then clicks "Submit"
app.post("/searchRoom.html", function(req, response){
	const date = req.body.date;
	const roomNum = req.body.roomNum;
	searchReservationRoomDate(req, response, date, roomNum);
})

//When employee/manager clicks on "Change Check In/Out" button on reservation modification page
app.post("/modifyDate.html", function(req, response){
	const firstName = req.body.firstName;
	const lastName = req.body.lastName;
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const adults = req.body.adults;
	const children = req.body.children;
	const confirmationNumber = req.body.confirmationNumber;
	const userID = req.body.userID;
	
	response.render("staffModifyDateEJS", {firstName: firstName,
										   lastName: lastName,
										   checkIn: checkIn,
										   checkOut: checkOut,
										   adults: adults,
										   children: children,
										   confirmationNumber: confirmationNumber,
										   userID: userID});
})

//When employee/manager clicks on "Cancel" button on the reservation modification page
//First, check if they are able to cancel with a full refund
//Display the cancel confirmation page
app.post("/cancel.html", function(req, response){
	const firstName = req.body.firstName;
	const lastName = req.body.lastName;
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const adults = req.body.adults;
	const children = req.body.children;
	const confirmationNumber = req.body.confirmationNumber;
	const userID = req.body.userID;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		//Retrieve our reservation
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			//Retrieve our cancellation policy
			dbo.collection("policy").findOne({}, function(err3, policy){
				if (err3)
					throw err3;
				let cancelValid = cancelIsValid(reservation.checkIn, policy.cancelTime);
				const cancelFee = Number(policy.cancelFee);
				response.render("staffCancelReservationEJS", {reservation: reservation, cancelValid: cancelValid, cancelFee: cancelFee, userID: userID});
			})
		})
	})
})

//When a user clicks "Cancel Reservation" after confirming they want to cancel
app.post("/cancelRequested.html", function(req, response){
	updateReport(req, true);
	removeReservation(req, response, true);
})

//Remove the check in/out dates in the rooms collection associated w/ the reservation
//Remove the reservation record
function removeReservation(req, response, canceled){
	const confirmation = req.body.confirmationNumber;
	const userID = req.body.userID;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmation}, function(err2, reservation){
			if (err2)
				throw err2;
			dbo.collection("room").find({}).toArray(function (err4, rooms){
				if (err4)
					throw err4;
				//Remove the check in/out dates in the rooms collection associated w/ the reservation
				for (let x = 0; x < reservation.assignedRoom.length; x++){
					const query = {roomNum: reservation.assignedRoom[x]};
					const update = {$pull: {reservedDates: {checkIn: reservation.checkIn}}};
					dbo.collection("room").updateOne(query, update, function(err5, result){
						if (err5)
							throw err5;
					})
					//Remove the reservation
					//Display "Your reservation has been canceled" page
					if (x+1 === reservation.assignedRoom.length){
						dbo.collection("reservation").deleteOne({confirmationNumber: confirmation}, function(err6, result2){
							if (err6)
								throw err6;
							response.render("staffCanceledEJS", {userID: userID, canceled: canceled});
						})
					}
				}
			})
		})
	})
}

//Add a date, price, and number of guests to the "report" collection
function updateReport(req, bCanceled){
	const confirmation = req.body.confirmationNumber;
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmation}, function(err2, reservation){
			if (err2)
				throw err2;
			if (reservation != null){
				dbo.collection("policy").findOne({}, function(err3, policy){
					const duration = Number(getStayDuration(reservation.checkIn, reservation.checkOut));
					var revenueObj = {};
					if (bCanceled){	//If canceled before the cancel-by date, give a full refund. Otherwise, charge the cancelation fee
						if (cancelIsValid(reservation.checkIn, policy.cancelTime))
							revenueObj = {date: reservation.checkOut, price: 0, bCanceled: bCanceled};
						else
							revenueObj = {date: reservation.checkOut, price: Number(policy.cancelFee), bCanceled: bCanceled};
					}
					else
						 revenueObj = {date: reservation.checkOut, price: Number(reservation.price), guests: reservation.adults+reservation.children, duration: duration, bCanceled: bCanceled};
					dbo.collection("report").insertOne(revenueObj, function(err3, result){
						if (err3)
							throw err3;
					})
				})
			}
		})
	})
}

//When staff enters a chat message in the reservation details page, and clicks on "Send"
//Add the message to the notes array in the reservation record
app.post("/sendChat.html", function (req, response){
	const staff = "Staff";
	const message = String(req.body.message);
	const today = new Date();
	const note = staff.concat(', ', today.toLocaleString(), ': ', message);
	const confirmationNumber = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const query = {confirmationNumber: confirmationNumber};
		const update = { $push: {"notes": note} };
		dbo.collection("reservation").updateOne(query, update, function(err2, result){
			if (err2)
				throw err2;
			searchReservation(req, response, confirmationNumber, null, null, null, null);
		})
		
	})
	
})


//When staff clicks on "Check In" on reservation details page
//Render the check in page
app.post("/checkIn.html", function(req, response){
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: req.body.confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("staffCheckInEJS", {userID: req.body.userID, reservation: reservation});			
		})
	})
})

//When staff clicks on "Check In" on check in page
//Set bCheckedIn to true in reservations collection
//Render the reservation details page after
app.post("/confirmCheckIn.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const query = {confirmationNumber: confirmationNumber};
		const update = {$set: {bCheckedIn: true}};
		dbo.collection("reservation").updateOne(query, update, function(err2, result){
			if (err2)
				throw err2;
			searchReservation(req, response, confirmationNumber, null, null, null, null);
		})
	})
})

//When staff clicks on "Check Out" on reservation details page
//Check to see if staff can check out the guest (is today on or after the guest's check in date?)
//Render the check out page
app.post("/checkOut.html", function(req, response){
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: req.body.confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("staffCheckOutEJS", {userID: req.body.userID, reservation: reservation});			
		})
	})	
})

//When staff clicks on "Check Out" on check out page
//Remove the reservation
//Delete the corresponding date objects in the reservedDates array of the rooms collection
//Update the "report" collection with the date, price, and number of guests
app.post("/confirmCheckOut.html", function(req, response){
	updateReport(req, false);
	removeReservation(req, response, false);
})

//When manager clicks on "Add/Remove Staff" button on homepage
app.post("/modifyStaff.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffModifyStaffEJS", {userID: userID});
})

//When manager clicks on "Add Staff User" button on Add/Remove staff page
app.post("/addStaff.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffAddStaffEJS", {userID: userID});
})

//When manager clicks on "Add User" button after filling out fields for a new staff employee
//Creates a new user document in the staff collection
app.post("/addStaffUser.html", function(req, response){
	const password = req.body.password;
	const validatePassword = req.body.validatePassword;
	if (password != validatePassword){
		alert("The passwords do not match");
		return;
	}
	const userID = req.body.userID;
	const staffUserID = req.body.employeeID;
	const username = req.body.username;
	const bManager = req.body.permission;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const user = {userID: staffUserID,
					 username: username,
					 password: password,
					 manager: bManager};
		dbo.collection("staff").insertOne(user, function(err2, result){
			if (err2)
				throw err2;
			response.render("staffConfirmAddUserEJS", {userID: userID});
		})
	})
})

//When manager clicks on "Remove Staff User" button on Add/Remove staff page
app.post("/removeStaff.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffRemoveStaffEJS", {userID: userID});
})

//When manager clicks on "Remove Staff User" button on Remove staff page
//Removes the associated user document from the staff collection
app.post("/removeStaffUser.html", function(req, response){
	const userID = req.body.userID;
	const employeeID = req.body.employeeID;
	
	if (userID == employeeID){
		alert("You cannot remove yourself!");
		return;
	}
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("staff").deleteOne({userID: employeeID}, function(err2, result){
			if (err2)
				throw err2;
			if (result.deletedCount === 0){
				alert("This user does not exist.");
				return;
			}
			response.render("staffConfirmRemoveUserEJS", {userID: userID});
		})
	})
})

//When manager clicks on Add/Remove Rooms button on staff homepage
app.post("/modifyRooms.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffRoomEJS", {userID: userID});
})

//When manager clicks on "Add Room" button on Modify Rooms page
app.post("/addRoom.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffAddRoomEJS", {userID: userID});
})

//When manager clicks on "Add Room" button after entering in new room information
//Creates a new document in the rooms collection
app.post("/addRoomRequested.html", function(req, response){
	const userID = req.body.userID;
	
	const room = {roomNum: Number(req.body.roomNum),
	 roomName: req.body.roomName,
	 maxOccupancy: Number(req.body.occupancy),
	 numBeds: Number(req.body.numBeds),
	 description: req.body.description,
	 image: req.body.image,
	 price: Number(req.body.price),
	 reservedDates: []};
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		//Make sure the new room number does not conflict with an existing room number
		dbo.collection("room").find({}).toArray(function(err2, rooms){
			if (err2)
				throw err2;
			for (let x = 0; x < rooms.length; x++){
				if (rooms[x].roomNum == room.roomNum){
					alert("The room number already exists. Enter a new room number.");
					return;
				}
				if (x+1 === rooms.length){
					//All good, add the room
					dbo.collection("room").insertOne(room, function(err3, result){
						if (err3)
							throw err3;
						response.render("staffConfirmAddRoomEJS", {userID: userID});
					})
				}
			}
		})
	})
})

//When manager clicks on "Edit Room" button on Modify Rooms page
app.post("/editRoom.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffEditRoomEJS", {userID: userID});
})

//When manager enters a room number to edit, and clicks on the "Edit" button
//Query the DB for the room and pre-fill the form with the room's information
app.post("/editRoomView.html", function(req, response){
	const userID = req.body.userID;
	const roomNum = Number(req.body.roomNum);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("room").findOne({roomNum: roomNum}, function(err2, room){
			if (err2)
				throw err2;
			if (room == null){
				alert("This room does not exist.");
				return;
			}
			response.render("staffEditRoomViewEJS", {userID: userID, room: room});
		})
	})
})

//When user enters in a room information to edit, and clicks on the "Save Changes" button
//Update the room document with the new parameters
app.post("/editRoomRequest.html", function(req, response){
	const userID = req.body.userID;
	const roomNum = Number(req.body.roomNum);
	
	const update = {$set: {roomName: req.body.roomName,
	maxOccupancy: Number(req.body.occupancy),
	numBeds: Number(req.body.numBeds),
	description: req.body.description,
	image: req.body.image,
	price: Number(req.body.price)}};
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("room").updateOne({roomNum: roomNum}, update, function(err2, result){
			if (err2)
				throw err2;
			response.render("staffConfirmEditRoomEJS", {userID: userID});
		})
	})
})

//When manager clicks on "Remove Room" button on Modify Rooms page
app.post("/removeRoom.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffRemoveRoomEJS", {userID: userID});
})

//When manager clicks on "View" button on Remove Room page
//Query Room collection for the requested room
//Display the info to the user
app.post("/removeViewRoom.html", function(req, response){
	const userID = req.body.userID;
	const roomNum = Number(req.body.roomNum);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("room").findOne({roomNum: roomNum}, function(err2, room){
			if (err2)
				throw err2;
			if (room == null){
				alert("Could not find the room");
				return;
			}
			response.render("staffRemoveRoomViewEJS", {room: room, userID: userID});
		})
	})
})

//When manager clicks on "Remove Room" button after searching a room to remove
//Check if the room has any current or future reservations
//If not, remove the selected document from the room collection
app.post("/removeRoomRequested.html", function(req, response){
	const userID = req.body.userID;
	const roomNum = Number(req.body.roomNum);

	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		
		dbo.collection("room").findOne({roomNum: roomNum}, function(err2, room){
			if (room.reservedDates.length > 0){
				alert("Cannot remove the room- there are current or future reservations");
				return;
			}

			dbo.collection("room").deleteOne({roomNum: roomNum}, function(err2, result){
				if (err2)
					throw err2;
				response.render("staffConfirmRemoveRoomEJS", {userID: userID});
			})
			
		})
	})
})

//When manager clicks on "Edit Policy" on staff homepage
app.post("/modifyPolicy.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffPolicyEJS", {userID: userID});
})

function displayPolicy(req, response, EJS){
	const userID = req.body.userID;
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		
		dbo.collection("policy").findOne({}, function(err2, policy){
			if (err2)
				throw err2;
			response.render(EJS, {userID: userID, policy: policy});		
		})
	})	
}

//When manager clicks on "Cancel Time" button on Edit Policy page
//Query from policy collection and display the current value to manager
app.post("/editCancelTime.html", function(req, response){
	displayPolicy(req, response, "staffEditCancelTimeEJS");
})

//When manager clicks on "Save Changes" button on Edit Cancel Time page
//Update the policy collection
app.post("/editCancelTimeRequested.html", function(req, response){
	const userID = req.body.userID;
	const cancelTime = Number(req.body.cancelTime);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const update = {$set: {cancelTime: cancelTime}};
		dbo.collection("policy").updateOne({}, update, function(err2, result){
			if (err2)
				throw err2;
			response.render("staffConfirmPolicyEJS", {userID: userID});
		})
	})
})

//When manager clicks on "Cancel Fee" button on Policy page
app.post("/editCancelFee.html", function(req, response){
	displayPolicy(req, response, "staffEditCancelFeeEJS");
})

//When manager clicks on "Save Changes" button on Edit Cancel Fee page
//Update the policy collection
app.post("/editCancelFeeRequested.html", function(req, response){
	const userID = req.body.userID;
	const cancelFee = Number(req.body.cancelFee);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const update = {$set: {cancelFee: cancelFee}};
		dbo.collection("policy").updateOne({}, update, function(err2, result){
			if (err2)
				throw err2;
			response.render("staffConfirmPolicyEJS", {userID: userID});
		})
	})	
})

//When manager clicks on "Check In Time" button on Policy page
app.post("/editCheckInTime.html", function(req, response){
	displayPolicy(req, response, "staffEditCheckInTimeEJS");
})

//When manager clicks on "Save Changes" button on Check In Time policy page
//Update the record in the policy collection
app.post("/editCheckInTimeRequested.html", function(req, response){
	const userID = req.body.userID;
	const hour = Number(req.body.hour);
	let minute = Number(req.body.minute);
	const zero = "0";
		if (minute <= 9)
			minute = zero.concat(String(minute));
	const meridiem = req.body.meridiem;
	const checkInTime = String(hour).concat(":", String(minute), " ", meridiem);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const update = {$set: {checkInTime: checkInTime}};
		dbo.collection("policy").updateOne({}, update, function(err2, result){
			if (err2)
				throw err2;
			response.render("staffConfirmPolicyEJS", {userID: userID});
		})
	})
})

app.post("/editCheckOutTime.html", function(req, response){
	displayPolicy(req, response, "staffEditCheckOutTimeEJS");
});


//When manager clicks on "Save Changes" button on Check Out Time policy page
//Update the record in the policy collection
app.post("/editCheckOutTimeRequested.html",function(req, response){
	const userID = req.body.userID;
	const hour = Number(req.body.hour);
	let minute = Number(req.body.minute);
	const zero = "0";
		if (minute <= 9)
			minute = zero.concat(String(minute));
	const meridiem = req.body.meridiem;
	const checkOutTime = String(hour).concat(":", String(minute), " ", meridiem);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const update = {$set: {checkOutTime: checkOutTime}};
		dbo.collection("policy").updateOne({}, update, function(err2, result){
			if (err2)
				throw err2;
			response.render("staffConfirmPolicyEJS", {userID: userID});
		})
	})	
})

//When manager clicks on "Business Report" button on staff homepage
app.post("/report.html", function(req, response){
	const userID = req.body.userID;
	response.render("staffBusinessReportDatesEJS", {userID: userID});
})

//When manager selects a start and end date on Business Report page, and clicks "Generate Report" button
//Query the Report collection for all documents with a date that falls within the start and end date range
//Sum up the prices of all the documents, and display the total price
app.post("/displayReport.html", function(req, response){
	const start = req.body.startDate;
	const end = req.body.endDate;
	
	//Validate start date comes before end date
	if (!validateDate(start, end)){
		alert("Start date must come before end date.");
		return;
	}
	
	const userID = req.body.userID;
	const startDate = new Date(getYear(start), getMonth(start)-1, getDay(start));
	const endDate = new Date(getYear(end), getMonth(end)-1, getDay(end));
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("report").find({}).toArray(function(err2, results){
			let revenue = 0;
			let guests = 0;
			let count = 0;
			let duration = 0;
			let cancelCount = 0;
			for (let x = 0; x < results.length; x++){
				const targetDate = new Date(getYear(results[x].date), getMonth(results[x].date)-1, getDay(results[x].date));
				if (targetDate.getTime() == startDate.getTime() || targetDate.getTime() == endDate.getTime() ||
				   (targetDate.getTime() > startDate.getTime() && targetDate.getTime() < endDate.getTime())){
					revenue += Number(results[x].price);
					if (results[x].bCanceled == false){
						guests += Number(results[x].guests);
						duration += Number(results[x].duration);
						count++;
					}
					else
						cancelCount++;
				}
				if (x+1 === results.length){
					if (count > 0)
						response.render("staffBusinessReportEJS", {userID: userID, revenue: Number(revenue)/1000, numReservations: Number(count), guests: Number(guests), avgDuration: duration/count, cancelCount: cancelCount});
					else
						response.render("staffBusinessReportEJS", {userID: userID, revenue: Number(revenue)/1000, numReservations: 0, guests: 0, avgDuration: 0, cancelCount: cancelCount});
				}
			}
		})
	})

})

//When staff clicks on "Modify Room" button on reservation details page
app.post("/modifyRoom.html", function(req, response){
	const userID = req.body.userID;
	const confirmationNumber = req.body.confirmationNumber;

	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("staffModifyRoomEJS", {userID: userID, reservation: reservation})		
		})
	})
})


//When staff clicks on "Add Room" button on Modify Room page
//Query a list of all available rooms for the reservation's check in and check out date
app.post("/modifyAddRoom.html", function(req, response){
	const userID = req.body.userID;
	const confirmationNumber = req.body.confirmationNumber;
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			dbo.collection("room").find({}).toArray(function(err2, rooms){
				if (err2)
					throw err2;
				let validRooms = [];
				for (let x = 0; x < rooms.length; x++){
					let valid = true;
					for (let y = 0; y < rooms[x].reservedDates.length; y++){
						if (!validateReservationConflict(checkIn, checkOut, rooms[x].reservedDates[y].checkIn, rooms[x].reservedDates[y].checkOut)){
							valid = false;
							break;
						}
					}
					if (valid)
						validRooms.push(rooms[x]);
					if (x+1 === rooms.length){
						response.render("staffModifyAddRoomEJS", {reservation: reservation, rooms: validRooms, userID: userID});						
					}
				}
			})			
		})
	})
})

//When staff clicks on "Add Room" button on Add Room page
//Calculate the price change
//Display confirmation
app.post("/modifyAddRoomRequested.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const userID = req.body.userID;
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const roomNum = Number(req.body.roomNum);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");

		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			dbo.collection("room").findOne({roomNum: roomNum}, function(err3, room){
				if (err3)
					throw err3;
				const roomPrice = room.price;
				const priceChange = getStayDuration(checkIn, checkOut)*roomPrice;
				response.render("staffConfirmModifyAddRoomEJS", {reservation: reservation, roomNum: roomNum, priceChange: priceChange, userID: userID})
			})
		})
	})	
})


//When staff clicks on "Add Room" after confirming price change
//Add room to reservation, update balance, update numRooms
//Update reservedDates in room
app.post("/confirmAddRoom.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const roomNum = Number(req.body.roomNum);
	const priceChange = Number(req.body.priceChange);
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		//Read from reservation
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			let newNumRooms = reservation.numRooms + 1;
			let balance = Number(reservation.price) + priceChange;
			const updateReservation = { $set: {numRooms: newNumRooms, price: Number(balance)}, $push: {"assignedRoom": roomNum} };
			dbo.collection("reservation").updateOne({confirmationNumber: confirmationNumber}, updateReservation, function(err3, result){
				if (err3)
					throw err3;
				const dates = {checkIn: checkIn, checkOut: checkOut};
				dbo.collection("room").updateOne({roomNum: roomNum}, { $push: {"reservedDates": dates} }, function(err4, result){
					if (err4)
						throw err4;
					searchReservation(req, response, confirmationNumber, null, null, null, null);					
				})
			})
		})
	})
})


//When staff clicks on "Remove Room" button on Modify Room page
//Query list of all rooms from reservation
app.post("/modifyRemoveRoom.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const userID = req.body.userID;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			dbo.collection("room").find({}).toArray(function(err3, rooms){
				if (err3)
					throw err3;
				let validRooms = [];
				for (let x = 0; x < reservation.assignedRoom.length; x++){
					for (let y = 0; y < rooms.length; y++){
						if (reservation.assignedRoom[x] == rooms[y].roomNum){
							validRooms.push(rooms[y]);
							break;
						}
					}
					if (x+1 === reservation.assignedRoom.length){
						response.render("staffModifyRemoveRoomEJS", {reservation: reservation, rooms: validRooms, userID: userID});
					}
				}
			})
		})
	})
})

//When staff clicks on "Remove Room" button on Remove Room page
//Calculate price change and display a confirmation page to user
//Make sure the user cannot remove the room if there is only one room left
//Or the max occupancy of the existing rooms does not meet the number of guests on reservation
app.post("/modifyRemoveRoomRequested.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const roomNum = Number(req.body.roomNum);
	const userID = req.body.userID;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			if (reservation.numRooms == 1){
				alert("You cannot remove this room.");
				return;
			}
			const numGuests = Number(reservation.adults) + Number(reservation.children);
			dbo.collection("room").find({}).toArray(function(err3, rooms){
				if (err3)
					throw err3;
				//First, see if removing this room would set the max occupancy of all rooms below the number of guests
				//Add all max occupancy of the reservation's rooms, except for the room to be deleted
				let newMaxOccupancy = 0;
				let priceChange = 0;
				for (let x = 0; x < reservation.assignedRoom.length; x++){
					for (let y = 0; y < rooms.length; y++){
						if (rooms[y].roomNum == reservation.assignedRoom[x]){
							if (rooms[y].roomNum != roomNum)
								newMaxOccupancy += rooms[y].maxOccupancy;
							else{
								priceChange = getStayDuration(reservation.checkIn, reservation.checkOut)*rooms[y].price;
							}
						}
					}
					if (x+1 === reservation.assignedRoom.length){
						if (newMaxOccupancy < Number(reservation.adults) + Number(reservation.children)){
							alert("Cannot remove this room- max occupancy cannot support guests.");
							return;
						}
						response.render("staffConfirmModifyRemoveRoomEJS", {reservation: reservation, priceChange: priceChange, roomNum: roomNum, userID: userID});
					}
				}
			})
		})
	})	
})


//When staff clicks on "Remove Room" after confirming the price change
//Remove the room from the reservation
//Update the balance in the reservation
//Remove the check in and check out dates from the room
app.post("/confirmRemoveRoom.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const roomNum = Number(req.body.roomNum);
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const numRooms = Number(req.body.numRooms);
	const priceChange = Number(req.body.priceChange);
	const price = Number(req.body.price);

	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const reservationUpdate = { $set: {numRooms: numRooms-1, price: price - priceChange}, $pull: {assignedRoom: {$in: [roomNum]}}}
		dbo.collection("reservation").updateOne({confirmationNumber: confirmationNumber}, reservationUpdate, function(err2, result){
			if (err2)
				throw err2;
			const roomUpdate = {$pull: {reservedDates: {checkIn: checkIn, checkOut: checkOut}}};
			dbo.collection("room").updateOne({roomNum: roomNum}, roomUpdate, function(err3, result){
				if (err3)
					throw err3;
				searchReservation(req, response, confirmationNumber, null, null, null, null);	
			})
		})
	})	
})

//TODO
//Add/Remove Guest
//Add a current balance to reservation details page
//Use Check in time, Check out time, and cancel fee in reservation details page
//MAYBE- Export the business report to a text document
//Realistic descriptions, images for rooms
//Add amentities attribute to rooms, display on reservations page and details page


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
				return false;
			}
		}
		else if (checkInMonth > checkOutMonth){
			return false;
		}
	}
	else if (checkInYear > checkOutYear){
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
	
	return today.getTime() == checkInDate.getTime() || (today.getTime() > checkInDate.getTime() && today.getTime() < checkOutDate.getTime());
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