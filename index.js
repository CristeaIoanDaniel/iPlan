require ('dotenv').config({path:'./vault.env'});
const express = require('express');
const app=express();
const pool=require('./config/db');
const servicesRouter= require('./routes/services.routes');
const itinerariesRouter=require('./routes/itineraries.routes');
const bookingRouter=require('./routes/booking.routes');
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
app.use('/api/services',servicesRouter);
app.use('/api/itineraries',itinerariesRouter);
app.use('/api/bookings',bookingRouter);
const PORT = process.env.PORT || 3000;
app.listen(PORT,() => {
    console.log('Server running on port ' + PORT);
})

