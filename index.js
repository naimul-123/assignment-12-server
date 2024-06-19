const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SEC_KEY)

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
        const cuponCollection = database.collection('cupons');

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
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: "Unauthorized access" })
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

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "Admin";
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden access' });
            }

            next();
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

        app.get('/agreements', verifyToken, verifyAdmin, async (req, res) => {
            const query = { status: "pending" }
            const result = await agreementCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/myagreement/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Unauthorized access" });
            }
            console.log(email)
            const query = { email: email }
            const result = await agreementCollection.findOne(query);
            res.send(result)
        })
        app.post('/agreement', async (req, res) => {
            const agreement = req.body;
            const { email } = agreement;
            const query = { email: email };
            const isAlreadyExist = await agreementCollection.countDocuments(query);
            if (isAlreadyExist) {
                return res.send({ message: "You have already one agreement." })
            }
            const result = await agreementCollection.insertOne(agreement);
            res.send(result)

        })

        app.patch('/acceptagreement', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.query.id;
            const email = req.query.email;
            const agreementFilter = { _id: new ObjectId(id) }
            const updatedAgreement = {
                $set: {
                    status: "checked"
                }
            };
            const agreementResult = await agreementCollection.updateOne(agreementFilter, updatedAgreement)
            const userFilter = { email: email }
            const updatedUser = {
                $set: {
                    role: "Member"
                }
            };

            if (agreementResult.modifiedCount) {
                const userResult = await userCollection.updateOne(userFilter, updatedUser)
                res.send(userResult)
            }





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
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Unauthorized access" });
            }
            const query = { role: "Member" }
            const members = await userCollection.find(query).toArray();

            res.send(members)
        })

        app.patch('/removeMember/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateUser = {
                $set: {
                    role: "user"
                }
            }

            const result = await userCollection.updateOne(filter, updateUser);

            res.send(result)


        })

        app.get('/allcupons', verifyToken, verifyAdmin, async (req, res) => {
            const result = await cuponCollection.find().toArray();
            res.send(result)
        })
        app.get('/activeCupon', async (req, res) => {
            const query = { isActive: true }
            const result = await cuponCollection.find(query).toArray();
            res.send(result)
        })




        app.post('/addcupon', verifyToken, verifyAdmin, async (req, res) => {
            const cupon = req.body;
            cupon.isActive = true;
            cupon.discount = parseInt(cupon.discount)



            const result = await cuponCollection.insertOne(cupon)

            res.send(result)
        });

        app.patch('/cupons/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }

            const cupon = await cuponCollection.findOne(filter);
            const { isActive } = cupon;
            const updateCupon = {
                $set: {
                    isActive: !isActive
                }
            }
            const result = await cuponCollection.updateOne(filter, updateCupon)
            res.send(result)

        })
        app.delete('/cupons/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await cuponCollection.deleteOne(filter)
            res.send(result)

        })



        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret

            })
        })


        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`server is running at http://localhost:${port}`)
})