import mongoose from "mongoose";

const UserSettingsSchema =new mongoose.Schema(
    {
 user:{type:mongoose.Schema.Types.ObjectId,ref:"User",unique:true,index:true,required:true},
 notifications:{
    emailUpdates:{type:Boolean,default:true},
    smsUpdates:{type:Boolean,default:false},
    sseLive:{type:Boolean,default:true},//keep SSE on by default
 },
    },
    {timestamps: true}

);

export default mongoose.model("UserSettings",UserSettingsSchema)