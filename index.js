const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()


const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const username = process.env.DB_USER;
const password = process.env.DB_PASS;
const secret = process.env.SEC_KEY;



app.get('/', async (req, res) => {

    res.send('Server is running ok')
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${username}:${password}@cluster0.nevhe4f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const database = client.db('appertmentDb');
        const slideCollection = database.collection('sliderdata');
        const userCollection = database.collection('users');
        const apartmentCollection = database.collection('apartments');
        const agreementCollection = database.collection('agreements');

        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, secret, {
                expiresIn: '1h'
            });
            res.send({ token })
        })
        // middlewares
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: "Forbidden access" })
            }
            jwt.verify(token, secret, (err, decoded) => {
                if (err) {
                    return res.status(403).send({ message: "Forbidden access" })
                }
                req.decoded = decoded;
                next();
                // console.log(req.decoded)
            })
        }
        app.get('/slides', async (req, res) => {
            const result = await slideCollection.find().toArray();
            res.send(result)

        })
        app.get('/apartments', async (req, res) => {
            const page = parseInt(req.query.page)
            const limit = 6;
            const skip = (page - 1) * limit;

            const apartments = await apartmentCollection.find().skip(skip).limit(limit).toArray();
            const totalapartments = await apartmentCollection.estimatedDocumentCount();
            const totalPage = Math.ceil(totalapartments / limit)
            res.send({ apartments, totalPage })
        })
        app.get('/apartment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await apartmentCollection.findOne(query)
            res.send(result)
        })
        app.post('/agreement', async (req, res) => {
            const agreement = req.body;
            const {
                name,
                email,
                floor_no,
                block_name,
                apartment_no,
                rent,
                status } = agreement;
            const query = { email: email };
            const isAlreadyExist = await agreementCollection.countDocuments(query);
            if (isAlreadyExist) {
                return res.send({ message: "You have already one agreement." })
            }
            const result = await agreementCollection.insertOne(agreement);
            res.send(result)

        })
        app.post('/users', async (req, res) => {
            const { name, email } = req.body;
            const query = { email: email }
            const insertUser = { $set: { name: name }, $setOnInsert: { email: email, role: "user" } }
            const options = { upsert: true }
            const result = await userCollection.updateOne(query, insertUser, options);
            res.send(result);
        })

        app.get('/users', verifyToken, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Unauthorized access" });

            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "Admin";
            res.send(isAdmin)
        })

        app.get('/users/member/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Unauthorized access" });
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isMember = user?.role === "Member";
            res.send(isMember)
        })
        app.get('/members', verifyToken, async (req, res) => {
            const email = req.query.email;
            console.log(email)
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Unauthorized access" });
            }
            const query = { role: "Member" }
            const members = await userCollection.findOne(query);

            res.send(members)
        })
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`server is running at http://localhost:${port}`)
})