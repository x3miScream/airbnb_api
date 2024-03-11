const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const download = require('image-downloader');
const multer = require('multer');
const fs = require('fs');

//Models
const UserModel = require('./Models/User.js');
const PlaceModel = require('./Models/Place.js');

const bcrypt_salt = bcrypt.genSaltSync(10);
const jwtSecret = 'my_custom_jwt_secret';
const mongoDBKey = 'WAPpsw2KrwylE3lg';

dotenv.config();

app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(__dirname + '/Uploads'))

app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000'
}));

mongoose.connect(process.env.MONGO_URL);


// Test Endpoint
app.get('/', (req, res) => {
    res.json('test ok');
});

// Test Endpoint
app.get('/testAuthentication', authenticateToken, (req, res) => {
    res.json(`test ok ${res.user}`);
});



// Register Endpoint
app.post('/register', async (req, res) => {
    const {name, email, password} = req.body;
    
    try
    {
        const userDoc = await UserModel.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcrypt_salt)
        });

        res.json(userDoc);
    }
    catch(e){
        res.status(422).json(e);
    }
});


//Authenticate middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(token == null) return res.setStatus(401);

    jwt.verify(token, jwtSecret, (err, user) => {
        if(err) return res.sendStatus(403);

        req.user = user;

        next();
    });
};


app.get('/profile', async (req, res) => {
    const {token} = req.cookies;

    if(token){
        jwt.verify(token, jwtSecret, {}, async (err, user) => {
            if(err)
                throw err;

            else
            {
                let userDoc = await UserModel.findById(user.id);
                
                if(userDoc)
                    res.json(userDoc);

                else
                    res.json(null);
            }
        });
    }
    else
    {
        res.json(null);
    }
});

app.post('/logout', async(req, res) => {
    res.cookie('token', '').json(true);
});

// Login Endpoint
app.post('/login', async (req, res) => {
    const {email, password} = req.body;

    try
    {
        const userDoc = await UserModel.findOne({email});

        if(userDoc)
        {
            const passswordOk = bcrypt.compareSync(password, userDoc.password);

            if(passswordOk)
            {
                jwt.sign({
                    name: userDoc.name,
                    email: userDoc.email,
                    id: userDoc._id
                },
                jwtSecret,
                {},
                (err, token) => {
                    if(err)
                        throw err;

                    res
                    //.cookie('token', token, {maxAge: 999999, httpOnly: true, expires: (new Date() + 99999)})
                    .cookie('token', token, {httpOnly: true})
                    .json(userDoc);

                    res.send('');
                });
            }
            else
                res.status(422).json('password wrong')    
        }
        else
        {
            res.json('not found')
        }
    }
    catch(e){
        res.status(404).json(e);
    }
});



app.post('/upload-by-link', async (req, res) => {
    const {link} = req.body;
    console.log(`link: ${link}`)
    const newName = Date.now() + '.jpg';
    const finalFileDestination = __dirname + '/Uploads/' + newName;

    const uploadOptions = {
        url: link,
        dest: finalFileDestination
    };

    await download.image(uploadOptions);

    res.json(newName);
});


const photosMiddleware = multer({dest: 'uploads'});
app.post('/upload', photosMiddleware.array('photos', 100), async (req, res) => {
    
    const uploadedFiels = [];

    for(let i=0;i<req.files.length;i++)
    {
        const {path, originalname} = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);

        uploadedFiels.push(newPath.replace('uploads\\', ''));
    }

    res.json(uploadedFiels);
});



app.post('/places', async (req, res) => {
    console.log('--> Adding a new place');

    const placesObject = req.body;
    const {title} = req.body;
    const {token} = req.cookies;
    let placeDoc = {};

    console.log(placesObject);

    if(token){
        jwt.verify(token, jwtSecret, {}, async (err, user) => {
            if(err)
            {
                console.log('--> Could not identity the user');
                throw err;
            }

            else
            {
                placeDoc = await PlaceModel.create({
                    owner: user.id,
                    title: placesObject.title,
                    address: placesObject.address,
                    photos: placesObject.addedPhotos,
                    description: placesObject.description,
                    perks: placesObject.perks,
                    extraInfo: placesObject.extraInfo,
                    checkIn: placesObject.checkIn,
                    checkOut: placesObject.checkOut,
                    maxGuests: placesObject.maxGuests
                });
            }

            res.json(placeDoc);

            console.log('--> Added a new place');
        });
    }
    else
    {
        res.json('Unauthorized access');
    }
});


app.listen(4000);