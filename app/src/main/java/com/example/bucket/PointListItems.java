package com.example.bucket;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;

public class PointListItems {
    ArrayList<PointListItem> list = new ArrayList<PointListItem>();

    public PointListItems(JsonArray jsonArr)
    {
        for(int i =0; i< jsonArr.size(); i++) {
            JsonObject temp = jsonArr.get(i).getAsJsonObject();
                list.add(new PointListItem(temp));
        }
    }

    public String toString() {
        String A = "";
        for(PointListItem item: list)
        {
            A += item.toString() + " \n";
        }
        return A;
    }

}
