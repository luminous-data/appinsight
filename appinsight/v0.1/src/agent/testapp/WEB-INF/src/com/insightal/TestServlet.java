package com.insightal;

import java.io.*;
import javax.servlet.ServletException;
import javax.servlet.http.*;

import java.util.logging.*;
import java.util.*;

public class TestServlet extends HttpServlet {
	
	public void init() throws ServletException {
		Enumeration<String> initParams = getServletConfig().getInitParameterNames();
		System.out.println(initParams + " initParams");

		Logger.logServer = getServletConfig().getInitParameter("logServer");
		Logger.collectionId = getServletConfig().getInitParameter("collectionId");
		HelloThread hello = new HelloThread();
		hello.start();
    }

	protected void processRequest(HttpServletRequest request, HttpServletResponse response)
    throws ServletException, IOException {
        try {
            Map parameters = request.getParameterMap();
            response.setContentType("text/html");
            Logger.log("hello this is a test");           
            PrintWriter out = response.getWriter();
			out.println("<h1>Hello</h1>");
            out.flush();
        } finally {

        }
    }


	protected void doGet(HttpServletRequest request, HttpServletResponse response)
    throws ServletException, IOException {
        processRequest(request, response);
    }


    protected void doPost(HttpServletRequest request, HttpServletResponse response)
    throws ServletException, IOException {
        processRequest(request, response);
    }



}