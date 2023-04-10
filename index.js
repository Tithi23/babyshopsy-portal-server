const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();


const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 5000;




admin.initializeApp({
    credential: admin.credential.cert({
        typeOf: process.env.TYPE_OF,
        privateKeyId: process.env.PRIVATE_KEY_ID,
        tokenUri: process.env.TOKEN_URI,
        clientId: process.env.CLIENT_ID,
        authUri: process.env.AUTH_URI,
        projectId: process.env.FIREBASE_PROJECT_ID, // I get no error here
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL, // I get no error here
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') // NOW THIS WORKS!!!

    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    authProvider: process.env.AUTH_PROVIDER_URL
});




app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wgw4c.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}






async function run() {
    try {
        await client.connect();
        const customersCollection = client.db('babyshopsy_portal').collection('customers');
        const usersCollection = client.db('babyshopsy_portal').collection('users');

        const productsCollection = client.db('babyshopsy_portal').collection('products')



        app.get('/products', async (req, res) => {
            const query = {};
            const options = await productsCollection.find(query).toArray();
            console.log(options)
            res.send(options);
        })


        // customer user


        app.get('/customers', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { email: email, date: date };
            const cursor = customersCollection.find(query);
            const orders = await cursor.toArray();
            res.json(orders);
        });



        app.post('/customers', async (req, res) => {
            const customer = req.body;
            const result = await customersCollection.insertOne(customer);
            res.json(result);

        });



        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });


        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });


        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })

    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Hello Babyshopsy portal!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})
