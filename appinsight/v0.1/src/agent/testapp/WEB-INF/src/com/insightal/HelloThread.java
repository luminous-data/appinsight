package com.insightal;

import java.io.*;
import javax.servlet.ServletException;
import javax.servlet.http.*;

import java.util.logging.*;
import java.util.*;


public class HelloThread extends Thread {
	Random random  = new Random();
	
    public void run() {
		System.out.println("Inside the run method");
		while (true) {
			
			try {
				Thread.sleep((long)(Math.random() * 3000));
			} catch (Exception ee) {
				Logger.log("Exception in Thread ");
			}
			
			Logger.log("Hello from Thread " + Thread.currentThread());
			int answer = random.nextInt(3) + 1;
			if (answer == 1) {
				try {
					f2();
				} catch (Exception e) {
					StringWriter sw = new StringWriter();
					PrintWriter pw = new PrintWriter(sw);
					e.printStackTrace(pw);
					HashMap logParams = new HashMap();
					logParams.put("message" , sw.toString());
					logParams.put("level", "ERROR");
					Logger.log(logParams);
				}
				
			}
			else if (answer == 2) {
				HashMap logParams = new HashMap();
				logParams.put("level", "INFO");
				logParams.put("message", "Selected option 2");
				Logger.log(logParams);
				readFile();
				
			}
			else {
				HashMap logParams = new HashMap();
				logParams.put("level", "INFO");
				logParams.put("message", "Selected option 3");
				logParams.put("httpStatus", 200);
				Logger.log(logParams);
				performSlowOperation();
			}
		}
    }
	
	
	public void performSlowOperation() {
		HashMap logParams = new HashMap();
		double t = Math.random() * 10;
		if (t < 3) {
			logParams.put("level", "INFO");
			logParams.put("message", "Speed is " + t);
		}
		else if (t < 6) {
			logParams.put("level", "WARN");
			logParams.put("message", "Speed is " + t);
		}
		else if (t > 6 && t < 10) {
			logParams.put("level", "CRITICAL");
			logParams.put("message", "Speed is " + t);
		}
		
		Logger.log(logParams);
	}
	
	
	public void readFile() {
		try(BufferedReader br = new BufferedReader(new FileReader("file.txt"))) {
			StringBuilder sb = new StringBuilder();
			String line = br.readLine();

			while (line != null) {
				sb.append(line);
				sb.append(System.lineSeparator());
				line = br.readLine();
			}
			String everything = sb.toString();
		} catch (Exception e) {
			StringWriter sw = new StringWriter();
			PrintWriter pw = new PrintWriter(sw);
			e.printStackTrace(pw);
			HashMap logParams = new HashMap();
			logParams.put("message" , sw.toString());
			logParams.put("level", "ERROR");
			Logger.log(logParams);
		}
	}
	
	public void f1() {
		f2();
	}
	
	public void f2() {
		f3();
	}
	
	public void f3() {
		int a = 5/0;
	}

}
