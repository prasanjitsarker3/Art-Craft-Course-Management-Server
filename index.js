const express = require('express');
const app = express()
const cors = require('cors')
const port = process.env.PORT || 5000;
require('dotenv').config()
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECK)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
//Middle Ware  
app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
  
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized Access' })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESSTOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'Unauthorized Access' })
        }
        req.decoded = decoded;
        next()
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ujahhqg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const instructorCollection = client.db("artCraftDB").collection("instructor");
        const classCollection = client.db("artCraftDB").collection("classes");
        const cartCollection = client.db("artCraftDB").collection("carts");
        const userCollection = client.db("artCraftDB").collection("users");
        const paymentCollection = client.db("artCraftDB").collection("payment");

        //JWT 
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESSTOKEN, { expiresIn: '1h' })
            res.send({ token })
        })

        // const verifyAdmin = async (req, res, next) => {
        //     const email = req.decoded.email;
        //     const query = { email: email }
        //     const user = await userCollection.findOne(query)
        //     if (user?.role !== "admin") {
        //         return res.status(403).send({ error: true, message: 'Forbidden Message' })
        //     }
        //     next()
        // }

        //Instructor Information & Collection
        app.get('/instructor', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result)
        })
        // Classes Information & Collection
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        })
        app.get('/class', async (req, res) => {
            const query = { status: 'approved' }
            const result = await classCollection.find(query).sort({enroll: -1}).toArray();
            res.send(result);
        })
        app.get('/class/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await classCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/class', async (req, res) => {
            const body = req.body;
            const result = await classCollection.insertOne(body)
            res.send(result)
        })
        app.patch('/class/pending/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }

            const updateDoc = {
                $set: {
                    status: 'approved'
                }
            }
            const result = await classCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        app.patch('/class/approved/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }

            const updateDoc = {
                $set: {
                    status: 'deny'
                }
            }
            const result = await classCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        //Cart Add and delete Information  section
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "Unauthorized Access" })
            }
            const query = { email: email }
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        })
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result)
        })
        app.get('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.findOne(query);
            res.send(result);
        })
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })
        //User Collection and Information
        app.get('/userAll', verifyJWT, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get('/users', verifyJWT, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existing = await userCollection.findOne(query)
            if (existing) {
                return res.send({ message: "User Already Exist" })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result);
        })
        //Creating Admin 
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);

        })
        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        //Creating Instructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);

        })
        app.patch("/users/instructor/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            }
            console.log(updateDoc, id);
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.get('/InsUser', async (req, res) => {
            const query = { role: "instructor" }
            const result = await userCollection.find(query).toArray();
            res.send(result);

        })
        //Create Payment Intent
        app.post('/createPayment', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'INR',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        app.get('/payments/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await paymentCollection.find(query).sort({ $natural: -1 }).toArray();
            res.send(result)
        })
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            const query = { _id: new ObjectId(payment.clsId) }
            const deleteResult = await cartCollection.deleteOne(query)
            console.log("Post Seats",payment.seats);
            const seats = payment.seats - 1;
            console.log("new seats",seats);
            const enrolled = parseInt(payment.enrolledStudent);
            const enrolledStudents = enrolled + 1;
            console.log("now", enrolledStudents); 
            const filter = { _id: new ObjectId(payment.classIds)}
            console.log(filter);
            const updateDoc = {
                $set: {
                    seats: seats,
                    enroll: enrolledStudents
                },
            };
            const updateResult = await classCollection.updateOne(filter, updateDoc)
            console.log(updateResult);
            // const query = { _id: { payment: clsId } }
            // const deleteResult = await cartCollection.deleteOne(query)
            res.send({ result, deleteResult, updateResult })
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Art & Craft Running Server")
})
app.listen(port, () => {
    console.log(`Server Running On ${port}`);
})