require ('dotenv').config({path:'./vault.env'});
const express = require('express');
const app=express();
const cors=require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const pool=require('./config/db');
const servicesRouter= require('./src/routes/services.routes');
const itinerariesRouter=require('./src/routes/itineraries.routes');
const bookingRouter=require('./src/routes/booking.routes');
const authRouter=require('./src/routes/auth.routes');
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'fail',
        message: 'Too many authentication requests. Please try again later.',
    },
});
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        callback(null, !origin || allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.get('/api/health',(req,res)=>{
    res.json({status:'ok', message:'iPlan backend is running ! '});
});
app.get('/api/db-check',async(req,res)=>{
    try{
        const result = await pool.query('SELECT NOW()');
        res.json({success:true, dbTime: result.rows[0].now});
    }catch(err){
        console.error(err);
        res.status(500).json({success:false, message:'Database connection failed'});
    }
})
app.use('/api/auth',authRateLimiter,authRouter);
app.use('/api/services',servicesRouter);
app.use('/api/itineraries',itinerariesRouter);
app.use('/api/bookings',bookingRouter);
app.use((err,req,res,next)=>{
    const statusCode= err.statusCode ||500;
    res.status(statusCode).json({
        status:err.status || 'Error',
        message:err.message || 'Internal Server Error',
    });
});
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT,() => {
        console.log('Server running on port ' + PORT);
    })
}

module.exports = app;
