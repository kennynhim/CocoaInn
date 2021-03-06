/*	This is a JavaScript file, executed on the Node JS Framework
**	Normally, JavaScript is executed on the client-side
**	Node JS is executed server side and allows us to connect to a database
**	Node JS also allows us to "serve" HTML files to the client and respond to HTTP GET and POST requests
**	Therefore, this is the main file from which we launch our website
**	To execute this file, you must have Node JS installed: https://nodejs.org/en/
**	Once installed, along with the required libraries listed below, open a command prompt/terminal and change directory(CD) to the location of this file
**	Then run the command: node guestScript.js
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

//When guest clicks on "Dine" link in menu bar
app.get("/dine.html", function(req, response){
	response.render("dineEJS");
})

app.get("/spa.html", function(req, response){
	response.render("spaEJS");
})

app.get("/winery.html", function(req, response){
	response.render("wineryEJS");
})

app.get("/contact.html", function(req, response){
	response.render("contactEJS");
})

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
			const local = new Date(today.getFullYear(), today.getMonth(), today.getDate());
			const todayString = local.toISOString();
			res.render("reservationEJS",
					   {bInit: true,
						numRooms: numRooms,
						rooms : result,
						checkIn: todayString.substr(0, 10),
						checkOut: todayString.substr(0,10),
						today: todayString.substr(0, 10),
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
			const today = new Date();
			const local = new Date(today.getFullYear(), today.getMonth(), today.getDate());
			const todayString = local.toISOString();
			res.render("reservationEJS", {bInit: false,
										  numRooms: numRooms,
										  checkIn: checkIn,
										  checkOut: checkOut,
										  today: todayString.substr(0, 10),
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
		for (let x = 0; x < numRooms; x++){
			priceSum += getStayDuration(checkIn, checkOut)*totalPrices[x];
		}
		
		//Get the policy
		MongoClient.connect(dbURL, function(err1, db){
			if (err1)
				throw err1;
			var dbo = db.db("CocoaInn");
			
			dbo.collection("policy").findOne({}, function (err2, policy){
				if (err2)
					throw err2;
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
										  price : priceSum,
										  policy: policy});
			})
		})
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
			price: Number(req.body.price),
			notes: [],
			assignedRoom: reservedRoomNums,
			confirmationNumber: crypto.randomUUID(),
			bCheckedIn: false,
			invoice: []
	}
	const today = new Date();
	const bill = {amount: Number(req.body.price), date: today.toLocaleDateString(), item: "Booked reservation."};
	reservation.invoice.push(bill);
	
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
	renderDetailsPage(req, response);
})

function renderDetailsPage(request, response){
	const confirmationNumber = request.body.confirmationNumber;
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
					dbo.collection("policy").findOne({}, function(err4, policy){
						if (err4)
							throw err4;
						response.render("modifyEJS", {reservation: result, rooms: reservedRooms, policy: policy});
						db.close();
					})
				})
			}
		})
	})
}

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
app.post("/confirmModification.html", function(req, response){
	//Calculate the price change, if any
	//Display the price change to user
	//Ask if they want to continue with modification
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const confirmation = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmation}, function(err2, reservation){
			if (err2)
				throw err2;
			if (reservation != null){
				//First, check if the reservation has been checked in
				//If so, check if the new check out date is sooner than the original check out date. If so, do not allow it
				if (reservation.bCheckedIn){
					const newCheckOutDate = new Date(getYear(checkOut), getMonth(checkOut)-1, getDay(checkOut));
					const oldCheckOutDate = new Date(getYear(reservation.checkOut), getMonth(reservation.checkOut)-1, getDay(reservation.checkOut));
					if (newCheckOutDate.getTime() < oldCheckOutDate.getTime()){
						alert("Once checked in, the new check out date cannot come sooner than the original check out date. Please contact front desk.");
						return;
					}
				}
				
				
				//Second, check if the new check in/out date conflicts with another reservation
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
							let newTotal = 0;
							let oldTotal = 0;
							for (let x = 0; x < reservation.assignedRoom.length; x++){
								for (let y = 0; y < rooms.length; y++){
									if (reservation.assignedRoom[x] === rooms[y].roomNum){
										newTotal += getStayDuration(checkIn, checkOut)*rooms[y].price;
										oldTotal += getStayDuration(reservation.checkIn, reservation.checkOut)*rooms[y].price;
										break;
									}
								}
							}
							//Get price change
							let priceChange = newTotal - oldTotal;
							response.render("confirmDateChangeEJS", {reservation: reservation, newCheckIn: checkIn, newCheckOut: checkOut, newPrice: reservation.price+priceChange, priceChange: priceChange});
						})
					}
				})
			}
		})
	})
})


//When user clicks on "Continue" from confirming the reservation date change
app.post("/changeDateRequested.html", function(req, response){
	const checkIn = req.body.checkIn;
	const checkOut = req.body.checkOut;
	const confirmation = req.body.confirmationNumber;
	
	if (!validateDate(checkIn, checkOut))
		return;
	
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
				const today = new Date();
				const bill = {amount: Number(req.body.priceChange), date: today.toLocaleDateString(), item: "Updated check in/out date."};
				dbo.collection("reservation").updateOne({confirmationNumber: confirmation}, { $set: {"checkIn": checkIn, "checkOut": checkOut, "price": Number(req.body.price)}, $push: {"invoice": bill} }, function(err4, result1){
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
										dbo.collection("policy").findOne({}, function(err8, policy){
											if (err8)
												throw err8;
											response.render("modifyEJS", {reservation: newReservation, rooms: reservedRooms, policy: policy});
										})
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

//When user clicks "Cancel Reservation" button on modification page
//First, check if guest is able to cancel reservation at all (they cannot if currently checked in- only staff can do so)
//Second, check if they are able to cancel with a full refund
//Display the cancel confirmation page
app.post("/cancel.html", function(req, response){
	const confirmation = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		//Retrieve our reservation
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmation}, function(err2, reservation){
			if (err2)
				throw err2;
			//If checked in, stop
			if (reservation.bCheckedIn){
				alert("Cannot cancel reservation after check in. Please contact front desk.");
				return;				
			}
			
			//Retrieve our cancellation policy
			dbo.collection("policy").findOne({}, function(err3, policy){
				if (err3)
					throw err3;
				let cancelValid = cancelIsValid(reservation.checkIn, policy.cancelTime);
				const cancelFee = policy.cancelFee;
				response.render("modifyCancelEJS", {reservation: reservation, cancelValid: cancelValid, cancelFee: cancelFee});
			})
		})
	})
})

//When a user clicks "Cancel Reservation" after confirming they want to cancel
//Remove the check in/out dates in the rooms collection associated w/ the reservation
//Remove the reservation record
app.post("/cancelRequested.html", function(req, response){
	const confirmation = req.body.confirmationNumber;
	updateReport(confirmation, true);
	
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
					const update = {$pull: {reservedDates: {checkIn: reservation.checkIn, checkOut: reservation.checkOut}}};
					dbo.collection("room").updateOne(query, update, function(err5, result){
						if (err5)
							throw err5;
					})
					//Remove the reservation
					//Display "Your reservation has been cancelled" page
					if (x+1 === reservation.assignedRoom.length){
						dbo.collection("reservation").deleteOne({confirmationNumber: confirmation}, function(err6, result2){
							if (err6)
								throw err6;
							dbo.collection("notifications").deleteMany({confirmationNumber: confirmation}, function(err7, result3){
								if (err7)
									throw err7;
								response.render("canceledEJS");
							})
						})
					}
				}
			})
		})
	})
})


//Add a date, price, and number of guests to the "report" collection
function updateReport(confirmationNumber, bCanceled){
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
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



//When user enters a chat message in the reservation details page, and clicks on "Send"
//Add the message to the notes array in the reservation record
//Add a notification to notifications table
app.post("/sendChat.html", function (req, response){
	const firstName = req.body.firstName;
	const lastName = req.body.lastName;
	const message = String(req.body.message);
	const today = new Date();
	const note = firstName.concat(', ', today.toLocaleString(), ': ', message);
	const confirmationNumber = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		const query = {confirmationNumber: confirmationNumber};
		const update = { $push: {"notes": note} };
		dbo.collection("reservation").updateOne(query, update, function(err2, result1){
			if (err2)
				throw err2;
			const notification = {confirmationNumber: confirmationNumber, firstName: firstName, lastName: lastName, message: today.toLocaleString().concat(': ', message)};
			dbo.collection("notifications").insertOne(notification, function(err3, result2){
				if (err3)
					throw err3;
				renderDetailsPage(req, response);				  
			})
		})
	})
})


//When user clicks on "Modify Room" button on details page
app.post("/modifyRoom.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;

	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("modifyRoomEJS", {reservation: reservation});
		})
	})
})
	
//When user clicks on "Add Room" button on Modify Room page
//Query the rooms collection of all available rooms for the check in and check out date
app.post("/addRoom.html", function(req, response){
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
						response.render("addRoomEJS", {reservation: reservation, rooms: validRooms});						
					}
				}
			})			
		})
	})
})
	

//When user clicks on "Add Room" button on Add Room page
//Calculate the price change if the user were to add this room to the reservation
//Then display a confirmation page asking if the user would like to add the room
app.post("/addRoomRequested.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
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
				let priceChange = 0;
				if (!reservation.bCheckedIn){
					priceChange = getStayDuration(checkIn, checkOut)*roomPrice;					
				}
				else{
					//Guest is checked in. Price change should only reflect between today and check out
					const today = new Date();
					const local = new Date(today.getFullYear(), today.getMonth(), today.getDate());
					priceChange = getStayDuration(local.toISOString.substr(0, 10), checkOut)*roomPrice;
				}
				response.render("confirmAddRoomEJS", {reservation: reservation, roomNum: roomNum, priceChange: priceChange})
			})
		})
	})
})

//When user confirms they want to add room after being shown the price change
//Update the reservation with the new room
//Update the room with the reservation's check in and check out dates
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
			const newNumRooms = reservation.numRooms + 1;
			const balance = Number(reservation.price) + priceChange;
			const today = new Date();
			const bill = {amount: Number(priceChange), date: today.toLocaleDateString(), item: "Added a room."};
			const updateReservation = { $set: {numRooms: newNumRooms, price: Number(balance)}, $push: {"assignedRoom": roomNum, "invoice": bill} };
			dbo.collection("reservation").updateOne({confirmationNumber: confirmationNumber}, updateReservation, function(err3, result){
				if (err3)
					throw err3;
				const dates = {checkIn: checkIn, checkOut: checkOut};
				dbo.collection("room").updateOne({roomNum: roomNum}, { $push: {"reservedDates": dates} }, function(err4, result){
					if (err4)
						throw err4;
					renderDetailsPage(req, response);
				})
			})
		})
	})
})


//When user clicks on "Remove Room" on Modify Room page
//First, check to see if the guest is allowed to remove a room (they cannot if they are currently checked in, only staff can do so)
//Query all the rooms of the user's reservation, and display the page
app.post("/removeRoom.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			if (reservation.bCheckedIn){
				alert("Cannot remove rooms once checked in. Please contact front desk.");
				return;
			}
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
						response.render("removeRoomEJS", {reservation: reservation, rooms: validRooms});
					}
				}
			})
		})
	})
})

//When user clicks on "Remove Room" button on Remove Room page
//Calculate price change and display a confirmation page to user
//Make sure the user cannot remove the room if there is only one room left
//Or the max occupancy of the existing rooms does not meet the number of guests on reservation
app.post("/removeRoomRequested.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const roomNum = Number(req.body.roomNum);
	
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
						response.render("confirmRemoveRoomEJS", {reservation: reservation, priceChange: priceChange, roomNum: roomNum});
					}
				}
			})
		})
	})
})

//When user confirms they want to remove room after being shown the price change
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
		const today = new Date();
		const bill = {amount: -priceChange, date: today.toLocaleDateString(), item: "Removed a room."};
		const reservationUpdate = { $set: {numRooms: numRooms-1, price: price - priceChange}, $pull: {assignedRoom: {$in: [roomNum]}}, $push: {"invoice": bill} }
		dbo.collection("reservation").updateOne({confirmationNumber: confirmationNumber}, reservationUpdate, function(err2, result){
			if (err2)
				throw err2;
			const roomUpdate = {$pull: {reservedDates: {checkIn: checkIn, checkOut: checkOut}}};
			dbo.collection("room").updateOne({roomNum: roomNum}, roomUpdate, function(err3, result){
				if (err3)
					throw err3;
				renderDetailsPage(req, response);
			})
		})
	})
})


app.post("/invoice.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("invoiceEJS", {invoice: reservation.invoice, confirmationNumber: confirmationNumber, balance: reservation.price});
		})
	})
})

//When guest clicks on "Add/Remove Guest" button on details page
app.post("/modifyGuest.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("modifyGuestEJS", {reservation: reservation});
		})
	})
})

//When guest clicks on "Add Guest" button on modify guest page
//Ask the user how many additional guests to add
//If the new total for number of guests exceeds the occupancy of the reservation, deny the request
app.post("/addGuest.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("addGuestEJS", {reservation: reservation});
		})
	})	
})

//When guest clicks on "Add Guest" button after entering in adult/children amounts to add
//Check if new guest total exceeds max occupancy of all rooms on reservation
//If it does, deny the request
//Otherwise, update adults and children values on reservation
app.post("/addGuestRequested.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const adults = Number(req.body.adults);
	const children = Number(req.body.children);
	
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
				let occupancy = 0;
				for (let x = 0; x < reservation.assignedRoom.length; x++){
					for (let y = 0; y < rooms.length; y++){
						if (reservation.assignedRoom[x] == rooms[y].roomNum){
							occupancy += rooms[y].maxOccupancy;
							break;
						}
					}
				}
				if (reservation.adults + reservation.children + adults + children > occupancy){
					alert("The number of guests in your party will exceed the occupancy of your booked rooms. Please add additional rooms.");
					return;
				}
				else{
					const newAdults = Number(reservation.adults + adults);
					const newChildren = Number(reservation.children + children);
					dbo.collection("reservation").updateOne({confirmationNumber: confirmationNumber}, {$set: {"adults": newAdults, "children": newChildren}}, function(err3, result){
						if (err3)
							throw err3;
						renderDetailsPage(req, response);
					})
				}
			})
		})
	})	
})

//When guest clicks on "Remove Guest" button on modify guest page
//Allow guest to remove all guests, down to one adult
app.post("/removeGuest.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			response.render("removeGuestEJS", {reservation: reservation});
		})
	})		
})

//When guest clicks on "Remove Guest" button after entering in a number of adults and children to remove
//Check if number of adults on reservation will be at least one
app.post("/removeGuestRequested.html", function(req, response){
	const confirmationNumber = req.body.confirmationNumber;
	const adults = Number(req.body.adults);
	const children = Number(req.body.children);
	
	MongoClient.connect(dbURL, function(err1, db){
		if (err1)
			throw err1;
		var dbo = db.db("CocoaInn");
		dbo.collection("reservation").findOne({confirmationNumber: confirmationNumber}, function(err2, reservation){
			if (err2)
				throw err2;
			if (reservation.adults - adults < 1){
				alert("You cannot remove this many adults from your reservation.");
				return;
			}
			else{
				const newAdults = reservation.adults - adults;
				let newChildren = reservation.children - children;
				if (newChildren < 0)
					newChildren = 0;
				dbo.collection("reservation").updateOne({confirmationNumber: confirmationNumber}, {$set: {"adults": newAdults, "children": newChildren}}, function(err3, result){
					if (err3)
						throw err3;
					renderDetailsPage(req, response);
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

//Checks if user can cancel their reservation with a full refund
//Returns true if they can
function cancelIsValid(checkIn, cancelTime){
	const checkInDate = new Date(getYear(checkIn), getMonth(checkIn)-1, getDay(checkIn));
	const cancelTimeMs = cancelTime*24*60*60*1000;
	const today = new Date();
	
	return today.getTime() <= checkInDate.getTime()-cancelTimeMs;
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