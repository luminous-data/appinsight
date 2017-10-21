package com.insightal;

import com.mashape.unirest.http.*;
import com.google.gson.*;
import java.util.concurrent.TimeUnit;
import java.util.*;

public class Logger {
	
	public static String logServer;
	public static String collectionId;
	public static void log(String message) {
		String url = "http://" + logServer + "/?channel=" + collectionId;
		try {
		/*
			HttpResponse<JsonNode> jsonResponse = Unirest.post(url)
										.header("accept", "application/json")
										.field("parameter", "value")
										.field("foo", "bar")
										.field("time", System.currentTimeMillis())
										.field("docType", "Java")
										.asJson();
		*/
			long currTime = System.currentTimeMillis();
			long timeSeconds = TimeUnit.MILLISECONDS.toSeconds(currTime);
			HttpResponse<JsonNode> jsonResponse = Unirest.post(url)
										.header("Content-Type", "application/json")
										.header("accept", "application/json")
										.body("{\"parameter\":\"value\", \"foo\":\"bar\", \"docType\":\"Java\", \"time\" : " + timeSeconds + " }")
										.asJson();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void log(HashMap params) {
		String url = "http://" + logServer + "/?channel=" + collectionId;
		try {
			long currTime = System.currentTimeMillis();
			long timeSeconds = TimeUnit.MILLISECONDS.toSeconds(currTime);
			params.put("time", timeSeconds);
			params.put("docType", "Java");
			Gson gson = new Gson(); 
			String json = gson.toJson(params);
			HttpResponse<JsonNode> jsonResponse = Unirest.post(url)
										.header("Content-Type", "application/json")
										.header("accept", "application/json")
										.body(json)
										.asJson();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
