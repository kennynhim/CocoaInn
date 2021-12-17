# CocoaInn

# Installation
Our web application uses Node JS.
Download Node JS: https://nodejs.org/en/

You will need to install some additional libraries.
1. Alert: https://www.npmjs.com/package/alert-node
2. EJS: https://ejs.co/
3. Express: https://expressjs.com/
4. Body Parser: https://www.npmjs.com/package/body-parser
5. Mongo DB: Enter the following command to install Mongo:
  npm install mongodb

# Setup
There are two views- the guest view and the staff view.

To execute the guest view, open a command prompt and cd to the location containing guestScript.js.

Enter the command:
node guestScript

Open a browser (perferably Google Chrome), and in the address bar type:
localhost:3000

To execute the staff view, enter the command (terminate guestScript first, if necessary):
nodestaffScript

Credentials for staff view:
username: employee
password: password123

username: manager
password: password123

# Guest Features
Guests can:
- create a reservation
- view the reservation details using the confirmation number
- modify their reservation: change check in/out date, add/remove rooms, add/remove guests, cancel the reservation
- view the invoice, which reflects the price changes from modifying the reservation
- send a chat message to staff

Once guests are checked in, they cannot move the check out date sooner, they cannot remove rooms, and they cannot cancel the reservation.

# Employee Features
Employees can:
- do most things a guest can do, but employees are not restricted when modifying guest reservations, even if the guest is checked in
- search for reservations using name, email, phone, date range, room number, or date and room combination
- receive message notifications if a guest chats with them

Note: a reservation for a guest will continue to exist indefinitely. The only ways to remove a reservation is by 1) canceling it or 2) checking out the guest. Reservations that have been neither checked out nor canceled, but with a check out date that has already passed, will fall under the "Open Reservations" tab. These reservations must be checked out or canceled in order for the revenue on the business report to be updated.

# Manager Features
Managers can:
- add, remove, and modify rooms
- add and remove staff users
- edit the Inn's policy- check in/out time, cancel time, cancel fee
- generate a business report for a specified date range

# Team Contribution
- Juilia - Guest front end (booking rooms, reservation details page, modifying reservations)
- Miles - Employee front end (staff home page, searching reservations, checking in/checking out, messages, open reservations)
- Nick - Manager front end (add/remove rooms, add/remove staff, business report, modifying policy)
- Kenny - Guest and staff back end
