const express=require('express');
const router=express.Router();
const pool=require('../config/db');
router.get('/', async(req,res)=>{
    const {location, category}=req.query;
    try{
        let queryText='SELECT * FROM  services';
        const values=[];
        if(location ||category){
            queryText+='WHERE';
            if(location){
                values.push(`%${location}%`);
                queryText+=`location ILIKE $$ {values.length}`;
            }
            if(category){
                if(values.length > 1) queryText+='AND';
                values.push(category);
                queryText+=`category == $${values.length}`;

            }
        }
        const {rows}=await pool.query(queryText,values);
        res.json({success:true, count:rows.length, data:rows});

    }catch(err){
        console.error('Error  fetching services:', err);
        res.status(500).json({success:false, error:'Server error'});
    }
});
router.post('/', async(req,res) =>{
    const {title, description, category, location, price_per_unit, unit_type}=req.body;
    if(!title || !category || !location || !price_per_unit){
        return res.status(400).json({success:false, error:'Missing required fields'});
    }
    try{
        const queryText = `
        INSERT INTO services (title, description, category, location, price_per_unit, unit_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
        `;
        const values=[title,description,category,location,price_per_unit,unit_type ||'night'];
        const {rows}= await pool.query(queryText,values);
        res.status(201).json({success:true,data:rows[0]});

    }catch(err){
        console.error('Error creating service:', err);
        res.status(500).json({success:false,error:'Server error'});
    }

});
module.exports=router;