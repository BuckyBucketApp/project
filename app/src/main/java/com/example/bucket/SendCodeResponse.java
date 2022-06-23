package com.example.bucket;


import com.google.gson.JsonObject;
import com.google.gson.annotations.SerializedName;



public class SendCodeResponse {

    @SerializedName("status")
    public String status;

    @SerializedName("msg")
    public String msg;


    public String toString() {
        return status + " " + msg;
    }



    public String getStatus() { return status; }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMsg() { return msg; }

    public void setMsg(String msg) {
        this.msg = msg;
    }



    public SendCodeResponse(JsonObject obj)
    {
        this.status = obj.get("status").toString();
        this.msg = obj.get("msg").toString();
    }

}
