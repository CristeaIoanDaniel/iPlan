const {createItinerarySchema}=require('./src/schemas/itinerary.schema');
const validate = require ('./src/middleware/validate.middleware');
const mockInvalidReq ={
    body :{
        title: 'hi',
        start_date:'2026-10-10',
        end_date:'2026-10-05',
    },
    query:{},
    params:{},
};
const mockRes = {};
const mockNext=(err) => {
    if (err) {
        console.log('FAILED');
        console.dir(err,{depth:null});
    }else{
        console.log('SUCCESS');
    }
};
const middleware = validate(createItinerarySchema);
middleware(mockInvalidReq,mockRes,mockNext);