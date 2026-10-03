const express=require('express');
const router=express.Router();
const pool=require('../config/db');
router.get('/', async(req,res)=>{
    const {location, category}=req.query;
    try{
        let queryText='SELECT * FROM  services';
        const values=[];
        if(location ||category){
            queryText+= ' WHERE ';
            if(location){
                values.push(`%${location}%`);
                queryText+=`location ILIKE $${values.length}`;
            }
            if(category){
               if(location) queryText += ' AND ';
                values.push(category);
                queryText+=`category = $${values.length}`;

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
        const values=[title,description,category,location,price_per_unit,unit_type ||'xxx'];
        const {rows}= await pool.query(queryText,values);
        res.status(201).json({success:true,data:rows[0]});

    }catch(err){
        console.error('Error creating service:', err);
        res.status(500).json({success:false,error:'Server error'});
    }

});
router.get('/:id',async(req,res) =>{
    const {id}= req.params;
    try{
        const queryText='SELECT * FROM services WHERE id=$1';
        const {rows}=await pool.query(queryText,[id]);
        if(rows.length===0){
            return res.status(404).json({success:false,error:'Service not found'});
        }
        res.json({success:true,data:rows[0]});

    }catch(err){
        console.error('Error fetching service:',err);
        res.status(500).json({success:false,error:'Server error'});
    }
});
router.post('/',async(req,res)=>{
    const {title,description,category,location,price_per_unit,unit_type}=req.body;
    if(!title||!category||!location||!price_per_unit){
        return res.status(400).json({success:false,error:'Missing required fields'});
    }
    try{
        const queryText=`
        INSERT INTO services (title, description, category, location, price_per_unit, unit_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
        `;
        const values= [title,description, category, location, price_per_unit, unit_type || 'xxx'];
        const {rows}= await pool.query(queryText,values);
        res.status(201).json({succes:true,data:rows[0]});
    }catch(err){
        console.error('Error creating service:',err);
        res.status(500).json({succes:false,error:'Server error'});
    }
});
router.put('/:id',async(req,res)=>{
    const {id}=req.params;
    const {title,description,category,location,price_per_unit,unit_type}=req.body;
    try{
        const queryText=`
            UPDATE services 
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                category = COALESCE($3, category),
                location = COALESCE($4, location),
                price_per_unit = COALESCE($5, price_per_unit),
                unit_type = COALESCE($6, unit_type)
            WHERE id = $7
            RETURNING *;
        `;
        const values = [title, description, category, location, price_per_unit, unit_type, id];
        const { rows } = await pool.query(queryText, values);
        if(rows.length ===0){
            return res.status(404).json({succes:false,error:'Service not found'});
        }
        res.json({succes:true,data:rows[0]});

    }catch(err){
        console.error('Error updating service: ',err);
        res.status(500).json({sucess:false,error:'Server error'});
    }
});
router.delete('/:id',async(req,res)=>{
    const {id}=req.params;
    try{
        const queryText='DELETE FROM services WHERE id=$1 RETURNING *';
        const {rows}=await pool.query(queryTextm[id]);
        if(rows.length===0){
            return res.status(404).json({sucess:false,error:'Service not found'});
        }
        res.json({sucess:true, message:'Service deleted sucessfully', data:rows[0]});
    }catch (err){
        console.error('Error deleting service: ',err);
        res.status(500).json({sucess:false,error:'Server error'});
    }
})

module.exports=router;