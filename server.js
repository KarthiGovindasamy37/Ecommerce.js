const express = require('express')
const app = express()
const cors = require('cors')
const mongodb = require('mongodb')
const mongoclient = mongodb.MongoClient
const dotenv = require('dotenv').config()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const random = require('randomstring')
const nodemailer = require('nodemailer')
const razorpay = require('razorpay')
const crypto = require("crypto");



const URL = process.env.URL
const DB = process.env.DB
const SECRET = process.env.SECRET
const USER = process.env.USER
const PASS = process.env.PASS
const RAZORPAY_KEY=process.env.RAZORPAY_KEY
const RAZORPAY_SECRET=process.env.RAZORPAY_SECRET

let instance= new razorpay({
key_id:RAZORPAY_KEY,
key_secret:RAZORPAY_SECRET
});

app.use(express.json())
app.use(cors())


let forgotMail=async(res,temp,mail)=>{
    try {
    
        let transporter = nodemailer.createTransport({
            host:"smtp.gmail.com",
            port:587,
            secure:false,
            auth:{
                user:USER,
                pass: PASS
            }
        });
        
        let info = await transporter.sendMail({
            from:USER,
            to:mail,
            subject:"Temporary password from Diva",
            text:"Please click the link below to reset your password",
            html:`<p>Your temporary password is  <b>${temp}</b></p>
                  <p>Copy the temporary password and submit it by clicking the 
                  temporary password link in the forgot password page</p>`
             })
        res.json({message:`Temporary password sent to ${mail}`})
    }
    catch (error) {
      res.status(500).json({message:"Something went wrong,please try again mail"})
    }
}

const Auth = (req,res,next) =>{
    
        if(req.headers.authorization){
            let decode = jwt.verify(req.headers.authorization,SECRET)
            if(decode){
                next()
            }else{
                res.status(440).json({message:"Session expired,Please login again"})
            }
        }else{
           res.status(401).json({message:"Please login your account"}) 
        }
    }


app.post("/signup",async(req,res) => {
    try {
        let connection = await mongoclient.connect(URL);

        let db = connection.db(DB);

        let user = await db.collection("users").findOne({email:req.body.email});

        if(!user){
            let salt = await bcrypt.genSalt(10);

            let hash = await bcrypt.hash(req.body.password,salt);

            req.body.password = hash;

            await db.collection("users").insertOne(req.body)

            res.json({message:"Account created successfully.Enjoy latest products and amazing deals only on Diva...!!"})
        }else{
            res.status(409).json({message:"Email id already exists"})
        }
    } catch (error) {
        res.status(500).json({message:"Something went wrong,please try again"})
    }

})

app.post('/login',async(req,res) => {
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let user = await db.collection("users").findOne({email:req.body.email})

        if(user){
            let compare = await bcrypt.compare(req.body.password,user.password)

        if(compare){
            let token = jwt.sign({id:user._id},SECRET,{expiresIn:"10d"})
           
            delete user.password
            delete user._id

            res.json({token,user})
        }
        else{    
            res.status(401).json({message:"Email or password is incorrect"})
        }
    }
    else{
        res.status(401).json({message:"Email or password is incorrect"}) 
    }
    } catch (error) {    
        res.status(500).json({message:"Something went wrong,please try again"})
    }
})

app.post("/forgot",async(req,res)=>{
   
    try {
        let connection = await mongoclient.connect(URL);

        let db = connection.db(DB);

        let user = await db.collection("users").findOne({email:req.body.email});
       
        if(user){

        let temp = random.generate(8)
        let mail = user.email

        await db.collection("users").findOneAndUpdate({email:mail},{$set:{temporaryPassword:temp}})
        
        forgotMail(res,temp,mail)

        }else{
            res.status(406).json({message:"Email id not valid"})
        }
    } catch (error) {

        res.status(500).json({message:"Something went wrong,please try again"})
    }
})

app.post("/temporarypass",async(req,res)=>{
    let pass=req.body.password
    let mail=req.body.email
   
    try {
        let connection=await mongoclient.connect(URL);

        let db=connection.db(DB);

        let user=await db.collection("users").findOne({email:mail})
        
        if(user){
            if(user.temporaryPassword){
            if(pass===user.temporaryPassword){

                await db.collection("users").findOneAndUpdate({email:user.email},{$unset:{temporaryPassword:""}})
                
                res.json({message:"Please change your password immediately"})
            }else{

                res.status(406).json({message:"Email or password is incorrect"})
            }
        }
        else{
            res.status(406).json({message:"Please create a temporary password by using forgot password page"})
        }
        
        }else{
            
            res.status(406).json({message:"Email or password is incorrect"})
        }
} catch (error) {
        res.status(500).json({message:"Something went wrong,please try again"})
    }
})

app.post("/resetpass",async(req,res)=>{
    try {
        let connection=await mongoclient.connect(URL);

        let db=connection.db(DB);
            
        let user=await db.collection("users").findOne({email:req.body.email});

        if(user){
            let salt=await bcrypt.genSalt(10);

            let hash=await bcrypt.hash(req.body.password,salt);
     
            await db.collection("users").findOneAndUpdate({email:user.email},{$set:{password:hash}})

            res.json({message:"Password updated successfully"})
        }else{
            res.status(406).json({message:"Email id not valid"})
        }
    } catch (error) {
        res.status(500).json({message:"Something went wrong,please try again"})
    }
})


app.get('/itemlist/:name', async(req,res) =>{
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let regexp = new RegExp(`${req.params.name}`,"i")

        let list = await db.collection("itemsList").find({name:{$regex:regexp}}).toArray()

        res.json(list)
    } catch (error) {
        
       res.status(500).json({message:"Something went wrong,please try again"}) 
    }
})

app.get('/dealsimages', async(req,res)=>{
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let items = await db.collection("dealsBlock").find().toArray()

        res.json(items)
    } catch (error) {
        
      res.status(500).json({message:"Something went wrong,please try again"})  
    }
})

app.get('/divablock', async(req,res)=>{
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let items = await db.collection("onlyBlock").find().toArray()

        res.json(items)
    } catch (error) {
      res.status(500).json({message:"Something went wrong,please try again"})  
    }
})

app.get('/products/:category',async(req,res)=>{
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let items = await db.collection(req.params.category).find().toArray()
        
        res.json(items)
    } catch (error) {
      res.status(500).json({message:"Something went wrong,please try again"})
    }
})

app.get('/viewproduct/:category/:id', async(req,res)=>{ 
    try {
        
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let item = await db.collection(req.params.category).findOne({_id:mongodb.ObjectId(req.params.id)})
      
        res.json(item)
    } catch (error) {
        
        res.status(500).json({message:"Something went wrong,please try again"})
    }
})

app.get('/filter/:collection', async(req,res)=>{
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let {min,max} = req.query
        
        if(max === "800"){
            let filteredItems = await db.collection(req.params.collection).find({price:{$gte:min}}).sort({price:1}).toArray()

            res.json(filteredItems)
        } 
        else{
            let filteredItems = await db.collection(req.params.collection).find({price:{$gte:min,$lte:max}}).sort({price:1}).toArray()
        
            res.json(filteredItems)
        }
    } catch (error) {
       res.status(500).json({message:"Something went wrong,please try again"}) 
    }
})

app.post("/razorpaypayment",Auth,async(req,res)=>{
    try {
        
        let amount = Number(req.body.item.price) * 100;
        let currency = "INR";

        let options={
            amount,
            currency,
            receipt:Math.random().toString(36).slice(-7)
        };

        let order=await instance.orders.create(options)
      
            let connection = await mongoclient.connect(URL)

            let db = connection.db(DB)

            await db.collection("users").findOneAndUpdate({email:req.body.user},{$set:{razorpay:order.id}})
        res.json({
            id:order.id,
            currency:order.currency,
            amount:order.amount
        })
    
    } catch (error) {
    
        res.status(500).json({message:"Sorry something went wrong,try again"})
    }
})

app.post("/razorpay/verify",async(req,res)=>{
    try{
 let connection = await mongoclient.connect(URL)

 let db = connection.db(DB)

 let d = new Date()
 let dd = d.getDate()
 let mm = d.getMonth() + 1
 let yy = d.getFullYear()

 let date = `${dd}-${mm}-${yy}`

 req.body.item.date = date
 req.body.item.quantity ? null : req.body.item.quantity = 1
 req.body.item.time = Date.now()

 await db.collection("users").findOneAndUpdate({email:req.body.user},
                                              {$push:{orders:{$each:[req.body.item],
                                               $sort:{time:-1}}}})

 let user = await db.collection("users").findOne({email:req.body.user})

 let order_id = user.razorpay

 let body=order_id + "|" + req.body.response.razorpay_payment_id;

 var expectedSignature = crypto.createHmac('sha256', RAZORPAY_SECRET)
                                  .update(body.toString())
                                  .digest('hex');

  
  if(expectedSignature === req.body.response.razorpay_signature){
    await db.collection("users").findOneAndUpdate({email:req.body.user},{$unset:{razorpay:""}})
      res.json({signatureIsValid:"true"});
  }else{
    res.json({signatureIsValid:"false"})
  }
    }
    catch{
        res.status(500).json({message:"Sorry something went wrong,try again"})
    }
  });

  app.get('/users',Auth,async(req,res)=>{
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let user = await db.collection("users").findOne({email:req.query.email})

        res.json(user.orders)
    } catch (error) {
       
        res.status(500).json({message:"Sorry something went wrong,try again"})
    }
  })

  app.get("/search/:collection/:value",async(req,res) =>{
    try {
        let connection = await mongoclient.connect(URL)

        let db = connection.db(DB)

        let {collection,value} = req.params

        let regexp = new RegExp(`${value}`,"i")

        let products = await db.collection(collection).find({name:{$regex:regexp}}).sort({price:1}).toArray()

        res.json(products)
    } catch (error) {
        res.status(500).json({message:"Sorry something went wrong,try again"})
    }
  })



app.listen(process.env.PORT || 3001)