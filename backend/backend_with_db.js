const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();

const userSchema = require("./models/user");
const listingModel = require("./models/listing");

const app = express();
const port = 5000;
app.use(cors());
app.use(express.json());

let conn;

function setConnection(newConn) {
  return (conn = newConn);
}

function getConnection() {
  if (!conn) {
    if (process.argv.includes("--prod")) {
      conn = mongoose.createConnection(
        "mongodb+srv://" +
          process.env.MONGO_USER +
          ":" +
          process.env.MONGO_PWD +
          "@polygold.uvj73.mongodb.net/" +
          process.env.MONGO_DB +
          "?retryWrites=true&w=majority",
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        }
      );
    } else {
      conn = mongoose.createConnection("mongodb://localhost:27017/PolyGold", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  }
  return conn;
}

app.get("/", async (req, res) => {
  res.status(201).send("hello PolyGold user");
});

// user login endpoint
app.get("/login/:email", async (req, res) => {
  const userModel = getConnection().model("User", userSchema);
  const email = req.params["email"];
  const user = await userModel.find({ email: email });

  if (user.length === 0) {
    const newUser = await createNewUser(email);
    // internal server error
    if (newUser == null) res.status(500).send(null);
    else res.status(201).send(newUser); // created
  } else {
    res.status(201).send(user[0]); // found
  }
});

// Get all users
app.get("/users", async (req, res) => {
  const userModel = getConnection().model("User", userSchema);
  const users_from_db = await userModel.find();
  res.status(201).send({ users_list: users_from_db });
});

// user profile edit endpoint
app.post("/replace_user", async (req, res) => {
  const userModel = getConnection().model("User", userSchema);
  const user = req.body;
  if (await userModel.findByIdAndUpdate(user._id, user))
    res.status(200).send(user);
  else res.status(404).send(null);
});

// Get user by their database id
app.get("/user/:id", async (req, res) => {
  const userModel = getConnection().model("User", userSchema);
  const id = req.params["id"];
  const user_from_db = await userModel.findById(id);
  res.status(201).send(user_from_db);
});

// user profile delete endpoint
app.delete("/user/:id", async (req, res) => {
  const userModel = getConnection().model("User", userSchema);
  const id = req.params.id;
  try {
    const user_from_db = await userModel.findById(id);
    for (let i = 0; i < user_from_db["listings"].length; i++) {
      await deleteListing(user_from_db["listings"][i]);
    }
    const result = await deleteUser(id);
    if (result) {
      res.status(202).send();
    } else {
      res.status(404).send("User id not found");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("An error ocurred in the server.");
  }
});

// Create a listing endpoint
app.post("/listing", async (req, res) => {
  const listing = req.body;
  listing["creation_date"] = new Date();
  if (await addListing(listing)) res.status(201).send(listing);
  else res.status(500).send(null);
});

// Get a listing by its database id
app.get("/listing/:id", async (req, res) => {
  const id = req.params["id"];
  const listing_from_db = await listingModel.findById(id);
  res.status(201).send({ listing_from_db });
});

// Get all listings
app.get("/listings", async (req, res) => {
  const listings_from_db = await listingModel.find();
  res.status(201).send({ listing_list: listings_from_db });
});

// Delete a listing by its database id
app.delete("/listing/:id", async (req, res) => {
  const id = req.params["id"];
  if (await deleteListing(id)) res.status(201).send();
  else res.status(500).send();
});

// Delete all users and lisitings from database
app.delete("/reset_db", async (req, res) => {
  await listingModel.deleteMany();
  await userModel.deleteMany();
  res.status(201).send();
});

async function createNewUser(email) {
  const basicUser = {
    name: "New User",
    email: email,
    image: "",
    listings: [],
  };
  // if correctly placed in the database, return the created user
  //    will have an '_id' variable appended as part of the addUser call
  if (await addUser(basicUser)) {
    return basicUser;
  } else return null;
}

async function addUser(user) {
  try {
    const userToAdd = new userModel(user);
    let added_user = await userToAdd.save();
    user["_id"] = added_user._id;
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function deleteUser(id) {
  try {
    const result = await userModel.findByIdAndDelete(id);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function addListing(listing) {
  try {
    // add listing to the database
    const ListingToAdd = new listingModel(listing);
    let added_listing = await ListingToAdd.save();
    listing["_id"] = added_listing._id;
    // Update the user with the listing
    const user = await userModel.findById(listing["seller"]);
    user["listings"].push(added_listing._id);
    await userModel.findByIdAndUpdate(user["_id"], user);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function deleteListing(id) {
  try {
    // delete listing from the database
    const deleted_listing = await listingModel.findById(id);
    if (deleted_listing === null) return false;
    await listingModel.findByIdAndDelete(id);
    // Update the user with the deleted listing
    const user = await userModel.findById(deleted_listing["seller"]);
    user["listings"].remove(id);
    await userModel.findByIdAndUpdate(user["_id"], user);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

const port_real = process.env.PORT || port;
app.listen(port_real, () => {
  console.log("REST API is listening at " + port_real);
});
